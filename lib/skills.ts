import { pool } from "./db";

export const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const SKILL_CONTENT_MAX_BYTES = 64 * 1024;

export type Skill = {
  id: string;
  name: string;
  content: string;
  declaredTools: string[];
  createdAt: string;
  updatedAt: string;
};

export function isValidSkillName(name: string): boolean {
  return SKILL_NAME_PATTERN.test(name);
}

export function validateSkillContent(content: string): string | null {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > SKILL_CONTENT_MAX_BYTES) {
    return `Skill content too large (${bytes} bytes; max ${SKILL_CONTENT_MAX_BYTES})`;
  }
  if (content.trim().length === 0) {
    return "Skill content must not be empty";
  }
  return null;
}

function rowToSkill(row: {
  id: string;
  name: string;
  content: string;
  declaredTools: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Skill {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    declaredTools: Array.isArray(row.declaredTools)
      ? row.declaredTools.filter((t): t is string => typeof t === "string")
      : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSkills(userId: string): Promise<Skill[]> {
  const result = await pool.query<{
    id: string;
    name: string;
    content: string;
    declaredTools: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `SELECT id, name, content, "declaredTools", "createdAt", "updatedAt"
     FROM skills WHERE "userId" = $1 ORDER BY name`,
    [userId]
  );
  return result.rows.map(rowToSkill);
}

export async function getSkillByName(
  userId: string,
  name: string
): Promise<Skill | null> {
  const normalized = name.toLowerCase();
  if (!isValidSkillName(normalized)) return null;
  const result = await pool.query<{
    id: string;
    name: string;
    content: string;
    declaredTools: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `SELECT id, name, content, "declaredTools", "createdAt", "updatedAt"
     FROM skills WHERE "userId" = $1 AND name = $2`,
    [userId, normalized]
  );
  return result.rows[0] ? rowToSkill(result.rows[0]) : null;
}

export async function createSkill(
  userId: string,
  input: { name: string; content: string; declaredTools?: string[] }
): Promise<Skill> {
  const name = input.name.toLowerCase();
  if (!isValidSkillName(name)) {
    throw new Error("Invalid skill name");
  }
  const contentError = validateSkillContent(input.content);
  if (contentError) {
    throw new Error(contentError);
  }
  const tools = input.declaredTools ?? [];
  const result = await pool.query<{
    id: string;
    name: string;
    content: string;
    declaredTools: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `INSERT INTO skills ("userId", name, content, "declaredTools")
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, content, "declaredTools", "createdAt", "updatedAt"`,
    [userId, name, input.content, JSON.stringify(tools)]
  );
  return rowToSkill(result.rows[0]);
}

export async function updateSkill(
  userId: string,
  name: string,
  patch: { content?: string; declaredTools?: string[] }
): Promise<Skill | null> {
  const normalized = name.toLowerCase();
  if (!isValidSkillName(normalized)) return null;

  const existing = await getSkillByName(userId, normalized);
  if (!existing) return null;

  const content = patch.content ?? existing.content;
  const contentError = validateSkillContent(content);
  if (contentError) {
    throw new Error(contentError);
  }
  const tools =
    patch.declaredTools !== undefined
      ? patch.declaredTools
      : existing.declaredTools;

  const result = await pool.query<{
    id: string;
    name: string;
    content: string;
    declaredTools: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `UPDATE skills SET content = $3, "declaredTools" = $4, "updatedAt" = now()
     WHERE "userId" = $1 AND name = $2
     RETURNING id, name, content, "declaredTools", "createdAt", "updatedAt"`,
    [userId, normalized, content, JSON.stringify(tools)]
  );
  return result.rows[0] ? rowToSkill(result.rows[0]) : null;
}

export async function deleteSkill(
  userId: string,
  name: string
): Promise<boolean> {
  const normalized = name.toLowerCase();
  if (!isValidSkillName(normalized)) return false;
  const result = await pool.query(
    'DELETE FROM skills WHERE "userId" = $1 AND name = $2',
    [userId, normalized]
  );
  return (result.rowCount ?? 0) > 0;
}

const SLASH_TOKEN_PATTERN = /(^|\s)\/([a-z0-9][a-z0-9-]{0,63})(?=\s|$)/gi;

export function extractSkillInvocations(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(SLASH_TOKEN_PATTERN)) {
    names.push(match[2].toLowerCase());
  }
  return [...new Set(names)];
}

export async function resolveSkillsForMessage(
  userId: string,
  latestUserMessage: string | null
): Promise<Skill[]> {
  if (!latestUserMessage) return [];
  const names = extractSkillInvocations(latestUserMessage);
  if (names.length === 0) return [];
  const skills = await Promise.all(
    names.map((name) => getSkillByName(userId, name))
  );
  return skills.filter((s): s is Skill => s !== null);
}

export function skillsPromptSection(skills: Skill[]): string {
  if (skills.length === 0) return "";
  const bodies = skills
    .map((s) => `### Skill: ${s.name}\n\n${s.content.trim()}`)
    .join("\n\n---\n\n");
  return `\n\n## Active skills

The user invoked the following skill(s) via slash commands. A "/name" token in
the user's message is an invocation marker — do not respond to it literally.
Follow the instructions below as part of your current work:

${bodies}`;
}
