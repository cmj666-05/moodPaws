import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { env } from '../config/env.js'

let dbInstance = null

export function getDb() {
  if (dbInstance) {
    return dbInstance
  }

  fs.mkdirSync(path.dirname(env.dbPath), { recursive: true })

  dbInstance = new DatabaseSync(env.dbPath)
  dbInstance.exec('PRAGMA foreign_keys = ON;')
  dbInstance.exec('PRAGMA journal_mode = WAL;')

  return dbInstance
}

export async function run(sql, params = []) {
  const statement = getDb().prepare(sql)
  const result = statement.run(...params)
  return {
    lastID: Number(result.lastInsertRowid || 0),
    changes: Number(result.changes || 0)
  }
}

export async function get(sql, params = []) {
  const statement = getDb().prepare(sql)
  return statement.get(...params)
}

export async function all(sql, params = []) {
  const statement = getDb().prepare(sql)
  return statement.all(...params)
}
