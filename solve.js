// A faster drop-in for csv-reader 1.0.0 (make.fun's reference CSV reader).
//
// run(input) returns exactly csv-reader 1.0.0's answer for every input {text, header}: the value
// {columns, rows, errors} produced by its written broken-row policy (BOM dropped, records end at
// LF or CRLF, blank lines are no records, stray CRs outside quotes dropped with stray_cr, quoted
// fields with "" escapes and CR/CRLF inside read as LF, junk after a closing quote appended with
// quote_junk, a quote that never closes read literally with unterminated_quote, rows padded or cut
// to the first record's width with short_row / long_row).
//
// Where the reference reads one character at a time and builds every field character by character,
// this reader moves in slices: it jumps between delimiters with indexOf and cuts each clean run of
// text out with a single slice, assembling a field from slices only where the text is actually
// broken (a stray CR, a doubled quote, a CR inside quotes). The answers are identical; only the
// walking differs.

/** csv-reader 1.0.0's answer for one case's input, computed faster. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xFEFF) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended (0 comma, 1 line break, 2 end of text), and how
  // many characters the last unquoted read kept (the quote_junk test).
  let fv = '';
  let fe = 2;
  let fa = 0;

  // Delimiters proven absent from the rest of the text (positions only move forward, so a search
  // that finds nothing once never finds anything later): keeps indexOf from rescanning the tail.
  let noComma = false;
  let noLF = false;
  let noCR = false;

  // The LFs in text[from, to): each one inside a quoted field still counts a line.
  function countLF(from, to) {
    let c = 0;
    let i = text.indexOf('\n', from);
    while (i !== -1 && i < to) {
      c += 1;
      i = text.indexOf('\n', i + 1);
    }
    return c;
  }

  // Reads unquoted characters onto `value` up to the next comma or line break: a CR not followed
  // by LF is dropped (stray_cr). Sets fv, fe, fa.
  function readUnquoted(value) {
    let added = 0;
    while (true) {
      let m = n;
      let mc = -1;
      if (!noComma) {
        const i = text.indexOf(',', pos);
        if (i === -1) noComma = true;
        else if (i < m) { m = i; mc = 44; }
      }
      if (!noLF) {
        const i = text.indexOf('\n', pos);
        if (i === -1) noLF = true;
        else if (i < m) { m = i; mc = 10; }
      }
      if (!noCR) {
        const i = text.indexOf('\r', pos);
        if (i === -1) noCR = true;
        else if (i < m) { m = i; mc = 13; }
      }
      if (mc === -1) {
        if (pos < n) {
          value += text.slice(pos, n);
          added += n - pos;
          pos = n;
        }
        fv = value; fe = 2; fa = added;
        return;
      }
      if (mc === 44) {
        if (m > pos) { value += text.slice(pos, m); added += m - pos; }
        pos = m + 1;
        fv = value; fe = 0; fa = added;
        return;
      }
      if (mc === 10) {
        if (m > pos) { value += text.slice(pos, m); added += m - pos; }
        pos = m + 1;
        line += 1;
        fv = value; fe = 1; fa = added;
        return;
      }
      // A CR: a line break when LF follows, else a stray CR that is dropped.
      if (text.charCodeAt(m + 1) === 10) {
        if (m > pos) { value += text.slice(pos, m); added += m - pos; }
        pos = m + 2;
        line += 1;
        fv = value; fe = 1; fa = added;
        return;
      }
      if (m > pos) { value += text.slice(pos, m); added += m - pos; }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      pos = m + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets fv, fe (fa only via the junk read).
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let value = '';
    let seg = pos; // the start of the raw run not yet copied into value
    while (true) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text after it is read again
        // as unquoted.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        readUnquoted('"');
        return;
      }
      if (!noCR) {
        const r = text.indexOf('\r', pos);
        if (r === -1) noCR = true;
        else if (r < q) {
          // CRLF and a lone CR inside quotes are each one LF.
          if (r > seg) {
            line += countLF(seg, r);
            value += text.slice(seg, r);
          }
          value += '\n';
          line += 1;
          pos = r + (text.charCodeAt(r + 1) === 10 ? 2 : 1);
          seg = pos;
          continue;
        }
      }
      if (text.charCodeAt(q + 1) === 34) {
        // A doubled quote inside the field is one quote.
        if (q > seg) {
          line += countLF(seg, q);
          value += text.slice(seg, q);
        }
        value += '"';
        pos = q + 2;
        seg = pos;
        continue;
      }
      // The closing quote.
      if (q > seg) {
        line += countLF(seg, q);
        value += text.slice(seg, q);
      }
      pos = q + 1;
      if (pos >= n) { fv = value; fe = 2; return; }
      const c = text.charCodeAt(pos);
      if (c === 44) { pos += 1; fv = value; fe = 0; return; }
      if (c === 10) { pos += 1; line += 1; fv = value; fe = 1; return; }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; fv = value; fe = 1; return; }
      // What follows the closing quote is appended as it stands, up to the next comma or line
      // break (quote_junk, when anything was appended).
      readUnquoted(value);
      if (fa > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return;
    }
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fv);
    } while (fe === 0);

    // A line that held only stray CRs is left with no characters: no record (its errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
