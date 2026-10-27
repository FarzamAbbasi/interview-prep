/**
 * IPP-1710: shows an answer / explanation with simple structure.
 *
 * Content format (plain text, so it still reads well anywhere):
 *   - Parts are separated by an empty line.
 *   - A part may start with a known label, e.g. "Short answer: ...", "Common mistake: ...", "Why B: ...".
 *     The label is shown small and bold above the text; mistakes and tips get a coloured box.
 *   - Lines after the first one inside a part that look like "200 OK: meaning" become a two-column list.
 * Text without any label (older content) is shown exactly as before.
 *
 * <AnswerText text={answer} className="text-[15px]" />
 */

const LABEL_RE =
  /^(Short answer|How it works|The ones you need|Example|Real example|Common mistake|Interview tip|Fix|Why not [A-D](?:(?:, | and )[A-D])*|Why [A-D])\s*:\s*(.*)$/i;
const ROW_RE = /^([^:]{1,45}):\s+(.+)$/;

const BOXES = {
  'common mistake': 'border-l-[3px] border-red-500 bg-red-50 px-3 py-2',
  'interview tip': 'border-l-[3px] border-brand-600 bg-brand-50 px-3 py-2',
};

function parse(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [first, ...rest] = block.split('\n');
      const match = first.match(LABEL_RE);
      return { label: match ? match[1] : null, first: match ? match[2] : first, rest };
    });
}

export default function AnswerText({ text, className = 'text-[15px]' }) {
  const parts = parse(text);

  // Older answers: no labels -> same look as before
  if (!parts.some((p) => p.label)) {
    return <p className={`max-w-prose whitespace-pre-line leading-relaxed text-slate-700 ${className}`}>{text}</p>;
  }

  return (
    <div className={`max-w-prose space-y-3 leading-relaxed text-slate-700 ${className}`}>
      {parts.map((part, i) => {
        const box = part.label ? BOXES[part.label.toLowerCase()] : '';
        return (
          <div key={i} className={box ? `rounded-md ${box}` : ''}>
            {part.label && (
              <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{part.label}</p>
            )}
            {part.first && <p className="whitespace-pre-line">{part.first}</p>}
            {part.rest.length > 0 && (
              <div className="mt-1 space-y-1">
                {part.rest.map((line, j) => {
                  const row = line.match(ROW_RE);
                  return row ? (
                    <div key={j} className="sm:grid sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-3">
                      <span className="block font-semibold text-slate-900">{row[1]}</span>
                      <span className="block">{row[2]}</span>
                    </div>
                  ) : (
                    <p key={j}>{line}</p>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
