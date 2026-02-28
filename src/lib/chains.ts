import { promises as fs } from "fs"
import path from "path"
import os from "os"
import crypto from "crypto"
import { withFileLock } from "./file-lock"

const DECK_DIR = path.join(os.homedir(), ".deck")
const CHAINS_FILE = path.join(DECK_DIR, "chains.json")

export interface Chain {
  id: string
  name: string
  sessionIds: string[]
  createdAt: string
  updatedAt: string
}

interface ChainsData {
  chains: Chain[]
}

async function readChains(): Promise<ChainsData> {
  try {
    const raw = await fs.readFile(CHAINS_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.chains)) {
      return parsed as ChainsData
    }
    return { chains: [] }
  } catch {
    return { chains: [] }
  }
}

async function writeChains(data: ChainsData): Promise<void> {
  await fs.mkdir(DECK_DIR, { recursive: true })
  await fs.writeFile(CHAINS_FILE, JSON.stringify(data, null, 2), "utf-8")
}

export async function getChains(): Promise<Chain[]> {
  const data = await readChains()
  return data.chains
}

export async function getChain(id: string): Promise<Chain | null> {
  const data = await readChains()
  return data.chains.find((c) => c.id === id) ?? null
}

export async function createChain(
  name: string,
  sessionIds: string[]
): Promise<Chain> {
  return withFileLock(CHAINS_FILE, async () => {
    const data = await readChains()
    const now = new Date().toISOString()
    const chain: Chain = {
      id: crypto.randomUUID(),
      name,
      sessionIds,
      createdAt: now,
      updatedAt: now,
    }
    data.chains.push(chain)
    await writeChains(data)
    return chain
  })
}

export async function addToChain(
  chainId: string,
  sessionId: string
): Promise<Chain> {
  return withFileLock(CHAINS_FILE, async () => {
    const data = await readChains()
    const chain = data.chains.find((c) => c.id === chainId)
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`)
    }
    if (!chain.sessionIds.includes(sessionId)) {
      chain.sessionIds.push(sessionId)
      chain.updatedAt = new Date().toISOString()
      await writeChains(data)
    }
    return chain
  })
}

export async function removeFromChain(
  chainId: string,
  sessionId: string
): Promise<Chain> {
  return withFileLock(CHAINS_FILE, async () => {
    const data = await readChains()
    const chain = data.chains.find((c) => c.id === chainId)
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`)
    }
    chain.sessionIds = chain.sessionIds.filter((id) => id !== sessionId)
    chain.updatedAt = new Date().toISOString()
    await writeChains(data)
    return chain
  })
}

export async function deleteChain(id: string): Promise<void> {
  return withFileLock(CHAINS_FILE, async () => {
    const data = await readChains()
    data.chains = data.chains.filter((c) => c.id !== id)
    await writeChains(data)
  })
}
