/**
 * 🔐 加密工具 Helper
 *
 * 使用 Node.js 內建 crypto 模組提供 AES-256-GCM 加密，
 * 不依賴任何外部套件，確保離線環境可用。
 *
 * 設計原則：
 * - 每台機器產生獨立金鑰（`.env.key`），不可跨機器共用
 * - `.env` 中的敏感值以 `ENC(base64...)` 格式儲存
 * - loadDotEnv 載入時自動透明解密，任務腳本無需修改
 * - 向後相容：未加密的明文值仍可正常使用
 */

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

/** 加密演算法：AES-256-GCM（認證加密，防篡改） */
const ALGORITHM = 'aes-256-gcm'

/** 金鑰長度：32 bytes = 256 bits */
const KEY_LENGTH = 32

/** IV（初始向量）長度：12 bytes（GCM 建議長度） */
const IV_LENGTH = 12

/** GCM 認證標籤長度：16 bytes = 128 bits */
const AUTH_TAG_LENGTH = 16

/** 加密值的前綴標記 */
const ENC_PREFIX = 'ENC('

/** 加密值的後綴標記 */
const ENC_SUFFIX = ')'

/** 金鑰檔案名稱 */
export const KEY_FILE_NAME = '.env.key'

/**
 * 檢查值是否為加密格式（`ENC(...)` 包裝）
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX) && value.endsWith(ENC_SUFFIX)
}

/**
 * 產生新的隨機加密金鑰
 */
export function generateKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH)
}

/**
 * 載入指定目錄下的金鑰檔案。
 *
 * @param dir 金鑰檔案所在目錄
 * @returns 金鑰 Buffer；找不到檔案時回傳 null
 */
export function loadKeyFile(dir: string): Buffer | null {
  const keyPath = path.join(dir, KEY_FILE_NAME)
  if (!fs.existsSync(keyPath)) {
    return null
  }
  const keyHex = fs.readFileSync(keyPath, 'utf8').trim()
  if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error(
      `❌ 金鑰檔案含有非法字元：${keyPath}\n` +
        `金鑰必須為純 hex 字元（0-9, a-f）。\n` +
        `請刪除此檔案後重新執行 .\\protect-env.ps1 產生新金鑰。`
    )
  }
  const keyBuf = Buffer.from(keyHex, 'hex')
  if (keyBuf.length !== KEY_LENGTH) {
    throw new Error(
      `❌ 金鑰檔案格式不正確：${keyPath}\n` +
        `預期 ${KEY_LENGTH} bytes（${KEY_LENGTH * 2} 個 hex 字元），實際 ${keyBuf.length} bytes。\n` +
        `請刪除此檔案後重新執行 .\\protect-env.ps1 產生新金鑰。`
    )
  }
  return keyBuf
}

/**
 * 取得或建立金鑰檔案。
 * 若檔案不存在，產生新的隨機金鑰並寫入。
 *
 * @param dir 金鑰檔案所在目錄
 * @returns 金鑰 Buffer
 */
export function getOrCreateKeyFile(dir: string): Buffer {
  const existing = loadKeyFile(dir)
  if (existing) {
    return existing
  }

  const key = generateKey()
  const keyPath = path.join(dir, KEY_FILE_NAME)
  fs.writeFileSync(keyPath, key.toString('hex') + '\n', { mode: 0o600 })
  return key
}

/**
 * 加密一個明文值。
 *
 * 輸出格式：`ENC(base64(iv + authTag + ciphertext))`
 * - iv: 12 bytes（GCM 建議長度）
 * - authTag: 16 bytes（完整性驗證）
 * - ciphertext: 可變長度
 *
 * @param plaintext 明文值
 * @param key 加密金鑰（32 bytes）
 * @returns 加密後的字串，含 `ENC(...)` 包裝
 */
export function encryptValue(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // 格式：base64(iv + authTag + encrypted)
  const combined = Buffer.concat([iv, authTag, encrypted])
  return `${ENC_PREFIX}${combined.toString('base64')}${ENC_SUFFIX}`
}

/**
 * 解密一個加密值。
 *
 * @param encryptedStr 含 `ENC(...)` 包裝的加密字串
 * @param key 加密金鑰（32 bytes）
 * @returns 解密後的明文
 * @throws 格式不正確、金鑰錯誤或資料被篡改時拋出錯誤
 */
export function decryptValue(encryptedStr: string, key: Buffer): string {
  if (!isEncrypted(encryptedStr)) {
    throw new Error('❌ 值未加密或格式不正確（缺少 ENC(...) 包裝）')
  }

  const base64Data = encryptedStr.slice(ENC_PREFIX.length, -ENC_SUFFIX.length)
  const combined = Buffer.from(base64Data, 'base64')

  const minLength = IV_LENGTH + AUTH_TAG_LENGTH
  if (combined.length < minLength) {
    throw new Error(
      `❌ 加密資料長度不足（最少 ${minLength} bytes，實際 ${combined.length} bytes）`
    )
  }

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

/**
 * 嘗試解密值：若為加密格式且有金鑰則解密，否則原值回傳。
 * 用於 loadDotEnv 的透明解密流程。
 *
 * @param value 原始值（可能是明文或 `ENC(...)` 格式）
 * @param key 加密金鑰（可為 null 表示無金鑰）
 * @returns 解密後的明文，或原始值
 */
export function tryDecrypt(value: string, key: Buffer | null): string {
  if (!isEncrypted(value)) {
    return value
  }
  if (!key) {
    throw new Error(
      `❌ 偵測到加密值 ENC(...)，但找不到金鑰檔案（${KEY_FILE_NAME}）。\n` +
        `請確認金鑰檔案存在於專案根目錄，或重新執行 .\\protect-env.ps1 產生金鑰。`
    )
  }
  return decryptValue(value, key)
}
