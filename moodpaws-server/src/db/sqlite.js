import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { env } from '../config/env.js'

let db

function getDatabase() {
  if (!db) {
    fs.mkdirSync(path.dirname(env.dbPath), { recursive: true })
    db = new DatabaseSync(env.dbPath)
    db.exec('PRAGMA foreign_keys = ON;')
  }

  return db
}

export function exec(sql) {
  getDatabase().exec(sql)
}

export function get(sql, params = []) {
  return Promise.resolve(getDatabase().prepare(sql).get(...params) ?? null)
}

export function all(sql, params = []) {
  return Promise.resolve(getDatabase().prepare(sql).all(...params))
}

export function run(sql, params = []) {
  const result = getDatabase().prepare(sql).run(...params)
  return Promise.resolve({
    changes: result.changes,
    lastID: Number(result.lastInsertRowid ?? 0)
  })
}
