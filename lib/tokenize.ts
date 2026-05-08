export interface TextToken {
  word: boolean
  val: string
}

export function tokenizeText(text: string): TextToken[] {
  const out: TextToken[] = []
  const re = /([a-zA-Z]+)|([^a-zA-Z]+)/g
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match[1]) out.push({ word: true, val: match[1] })
    else out.push({ word: false, val: match[2] })
  }

  return out
}
