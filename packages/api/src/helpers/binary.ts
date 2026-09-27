import { open } from 'node:fs/promises'

/** Whether the file's first `bytes` bytes contain a NUL byte (text files don't). */
export async function isBinaryFile(file: string, bytes: number): Promise<boolean> {
  const fh = await open(file, 'r')
  try {
    const buf = Buffer.alloc(bytes)
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
    return buf.subarray(0, bytesRead).includes(0)
  } finally {
    await fh.close()
  }
}
