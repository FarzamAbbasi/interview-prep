import { HiOutlineLockClosed } from 'react-icons/hi';
import DifficultyTag from '../practice/DifficultyTag';

const Label = ({ children }) => (
  <p className="mb-1.5 mt-5 font-mono text-[11px] font-semibold uppercase tracking-wider text-brand-600">{children}</p>
);

/**
 * IPP-1725: the coding problem during an interview round: description only (no hints / solution tabs).
 * Same look as the Description tab of the Solve page (ProblemPanel).
 */
export default function InterviewProblem({ problem }) {
  return (
    <section className="h-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-[15px] leading-relaxed text-slate-700">
      <h1 className="text-xl font-bold text-slate-900">{problem.title}</h1>
      <div className="mt-2 flex flex-wrap gap-2">
        <DifficultyTag difficulty={problem.difficulty} />
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{problem.topic}</span>
      </div>
      {problem.scenario && (
        <p className="mt-4 rounded-lg border-l-[3px] border-brand-600 bg-brand-50 px-3 py-2 text-sm italic text-slate-700">{problem.scenario}</p>
      )}
      <p className="mt-4 whitespace-pre-line">{problem.description}</p>

      {problem.examples.map((ex, i) => (
        <div key={i}>
          <Label>Example {i + 1}</Label>
          <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 font-mono text-[13px] text-slate-900">
            {`Input:  ${ex.input}\nOutput: ${ex.output}`}
          </pre>
          {ex.explanation && <p className="mt-1.5 text-sm text-slate-500">{ex.explanation}</p>}
        </div>
      ))}

      {problem.constraints.length > 0 && (
        <>
          <Label>Constraints</Label>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {problem.constraints.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 flex items-start gap-2 text-sm text-slate-500">
        <HiOutlineLockClosed className="mt-0.5 shrink-0" />
        Hints and solution are off during the interview. Submit runs every test, hidden ones too.
      </p>
    </section>
  );
}
