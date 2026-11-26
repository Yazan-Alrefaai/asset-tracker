//! Local SQLite database.
//!
//! The app's data lives in one SQLite file inside the OS app-data folder
//! (macOS: ~/Library/Application Support/<identifier>/, Windows: %APPDATA%\<identifier>\),
//! never inside the project folder. The frontend sends SQL with `?` placeholders;
//! all queries run on one connection behind a mutex, and `db_batch` runs in a transaction.

use rusqlite::types::{Value as SqlValue, ValueRef};
use rusqlite::{params_from_iter, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

const DB_FILE: &str = "asset-tracker.db";
const BACKUP_DIR: &str = "backups";

pub struct DbState {
    conn: Mutex<Connection>,
    path: PathBuf,
}

pub fn open(app: &AppHandle) -> Result<DbState, Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(DB_FILE);
    let conn = Connection::open(&path)?;
    conn.busy_timeout(Duration::from_secs(5))?;
    conn.pragma_update_and_check(None, "journal_mode", "WAL", |row| row.get::<_, String>(0))?;
    conn.pragma_update(None, "foreign_keys", true)?;
    Ok(DbState {
        conn: Mutex::new(conn),
        path,
    })
}

fn to_sql(v: &Value) -> Result<SqlValue, String> {
    Ok(match v {
        Value::Null => SqlValue::Null,
        Value::Bool(b) => SqlValue::Integer(i64::from(*b)),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqlValue::Integer(i)
            } else if let Some(f) = n.as_f64() {
                SqlValue::Real(f)
            } else {
                return Err(format!("unsupported number: {n}"));
            }
        }
        Value::String(s) => SqlValue::Text(s.clone()),
        Value::Array(_) | Value::Object(_) => {
            return Err("arrays and objects cannot be SQL parameters".into())
        }
    })
}

fn to_json(v: ValueRef<'_>) -> Value {
    match v {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::from(i),
        ValueRef::Real(f) => Number::from_f64(f).map(Value::Number).unwrap_or(Value::Null),
        ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(_) => Value::Null,
    }
}

fn params(values: &[Value]) -> Result<Vec<SqlValue>, String> {
    values.iter().map(to_sql).collect()
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[derive(Deserialize)]
pub struct Statement {
    sql: String,
    #[serde(default)]
    params: Vec<Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecResult {
    rows_affected: usize,
    last_insert_id: i64,
}

#[tauri::command]
pub fn db_execute(
    state: State<'_, DbState>,
    sql: String,
    params: Option<Vec<Value>>,
) -> Result<ExecResult, String> {
    let conn = state.conn.lock().map_err(err)?;
    let p = self::params(&params.unwrap_or_default())?;
    let rows_affected = conn.execute(&sql, params_from_iter(p)).map_err(err)?;
    Ok(ExecResult {
        rows_affected,
        last_insert_id: conn.last_insert_rowid(),
    })
}

#[tauri::command]
pub fn db_select(
    state: State<'_, DbState>,
    sql: String,
    params: Option<Vec<Value>>,
) -> Result<Vec<Map<String, Value>>, String> {
    let conn = state.conn.lock().map_err(err)?;
    let p = self::params(&params.unwrap_or_default())?;
    let mut stmt = conn.prepare(&sql).map_err(err)?;
    let columns: Vec<String> = stmt.column_names().map(|c| c.to_string()).collect();
    let mut rows = stmt.query(params_from_iter(p)).map_err(err)?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(err)? {
        let mut obj = Map::with_capacity(columns.len());
        for (i, name) in columns.iter().enumerate() {
            obj.insert(name.clone(), to_json(row.get_ref(i).map_err(err)?));
        }
        out.push(obj);
    }
    Ok(out)
}

/// Runs all statements in one transaction: either all succeed or nothing changes.
#[tauri::command]
pub fn db_batch(state: State<'_, DbState>, statements: Vec<Statement>) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(err)?;
    let tx = conn.transaction().map_err(err)?;
    for s in &statements {
        let p = params(&s.params)?;
        tx.execute(&s.sql, params_from_iter(p))
            .map_err(|e| format!("{e} (in: {})", s.sql))?;
    }
    tx.commit().map_err(err)
}

fn backups_dir(state: &DbState) -> PathBuf {
    state
        .path
        .parent()
        .map(|p| p.join(BACKUP_DIR))
        .unwrap_or_else(|| PathBuf::from(BACKUP_DIR))
}

fn list_backups(dir: &PathBuf) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .filter(|n| n.starts_with("asset-tracker-") && n.ends_with(".db"))
                .collect()
        })
        .unwrap_or_default();
    names.sort();
    names
}

/// Copies the database to backups/asset-tracker-<stamp>.db and keeps only the newest `keep` files.
#[tauri::command]
pub fn db_backup(
    state: State<'_, DbState>,
    stamp: String,
    keep: Option<usize>,
) -> Result<String, String> {
    if stamp.is_empty() || !stamp.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("invalid backup name".into());
    }
    let dir = backups_dir(&state);
    std::fs::create_dir_all(&dir).map_err(err)?;
    let target = dir.join(format!("asset-tracker-{stamp}.db"));
    if target.exists() {
        std::fs::remove_file(&target).map_err(err)?;
    }
    {
        let conn = state.conn.lock().map_err(err)?;
        conn.execute("VACUUM INTO ?1", [target.to_string_lossy().into_owned()])
            .map_err(err)?;
    }
    let keep = keep.unwrap_or(14).max(1);
    let names = list_backups(&dir);
    if names.len() > keep {
        for old in &names[..names.len() - keep] {
            let _ = std::fs::remove_file(dir.join(old));
        }
    }
    Ok(target.to_string_lossy().into_owned())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbInfo {
    path: String,
    size_bytes: u64,
    backups_dir: String,
    backups: Vec<String>,
}

#[tauri::command]
pub fn db_info(state: State<'_, DbState>) -> Result<DbInfo, String> {
    let dir = backups_dir(&state);
    Ok(DbInfo {
        path: state.path.to_string_lossy().into_owned(),
        size_bytes: std::fs::metadata(&state.path).map(|m| m.len()).unwrap_or(0),
        backups_dir: dir.to_string_lossy().into_owned(),
        backups: list_backups(&dir),
    })
}

/// Opens the folder that holds the database in Finder / Explorer.
#[tauri::command]
pub fn open_data_folder(state: State<'_, DbState>) -> Result<(), String> {
    tauri_plugin_opener::reveal_item_in_dir(&state.path).map_err(err)
}
