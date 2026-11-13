// Test helper (Shared Research B2, review d3): a source file's code with its comments taken out and its strings,
// templates and regex literals kept whole. The scans in sharedResearch.boundary.test.js and
// sharedResearchCopy.guard.test.js read code through it. A plain regex strip let a '/*' inside a string (a glob such
// as '../SharedResearch/*.jsx', or a line comment naming "api/*") open a false block comment that ran to the next
// real '*/' and deleted the code between.
//
// A '/' opens a regex literal where an expression may start: at the file's start, after an operator or opening
// punctuation, or after a keyword such as return. Anywhere else it is division. JSX's '</tag>' and '/>' are never
// regexes ('<' is not in the set, and a '/' before '>' is not one). That is enough for the code this repository holds;
// the scans' own rows check it on every src/ file.

const REGEX_AFTER = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '>', '~', '^']);
const REGEX_KEYWORDS = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/;

export function stripComments(code) {
  let out = '';
  let i = 0;
  const n = code.length;
  const regexMayStart = () => {
    let k = out.length - 1;
    while (k >= 0 && /\s/.test(out[k])) k -= 1;
    if (k < 0) return true;
    return REGEX_AFTER.has(out[k]) || REGEX_KEYWORDS.test(out.slice(Math.max(0, k - 9), k + 1));
  };
  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === '/' && next === '*') { // a block comment: replaced by one space, so tokens either side stay apart
      const end = code.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      out += ' ';
    } else if (ch === '/' && next === '/') { // a line comment: up to the line's end (its CR or LF is kept)
      while (i < n && code[i] !== '\n' && code[i] !== '\r') i += 1;
    } else if (ch === "'" || ch === '"' || ch === '`') { // a string or a template, escapes honoured
      let j = i + 1;
      while (j < n && code[j] !== ch) {
        if (code[j] === '\\') j += 1;
        else if (ch !== '`' && code[j] === '\n') break;
        j += 1;
      }
      out += code.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '/' && next !== '>' && regexMayStart()) { // a regex literal, its [classes] honoured
      let j = i + 1;
      let inClass = false;
      while (j < n && code[j] !== '\n' && code[j] !== '\r') {
        if (code[j] === '\\') j += 1;
        else if (code[j] === '[') inClass = true;
        else if (code[j] === ']') inClass = false;
        else if (code[j] === '/' && !inClass) break;
        j += 1;
      }
      out += code.slice(i, j + 1);
      i = j + 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}
