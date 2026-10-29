import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap, Decoration } from '@codemirror/view';
import { Compartment, Prec, StateEffect, StateField } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { ensureSyntaxTree } from '@codemirror/language';

/**
 * IPP-1717: code editor (CodeMirror 6) with JavaScript colors, line numbers and auto-indent.
 *   <CodeEditor initialValue onChange fontSize errorLine onRun editorRef />
 * editorRef.current gets: getValue(), setValue(text), insert(text), syntaxErrorLine(), focus()
 * Remount it (key=...) to load another problem.
 */

// Red background on one line (the line of the last error); cleared as soon as the code changes
const setErrorLine = StateEffect.define();
const errorLineField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    let next = tr.docChanged ? Decoration.none : deco;
    for (const e of tr.effects) {
      if (!e.is(setErrorLine)) continue;
      next =
        e.value && e.value <= tr.state.doc.lines
          ? Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(tr.state.doc.line(e.value).from)])
          : Decoration.none;
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const baseTheme = EditorView.theme(
  {
    '&': { height: '100%', backgroundColor: '#1d1934' },
    '.cm-scroller': { fontFamily: '"JetBrains Mono", ui-monospace, monospace', lineHeight: '1.65' },
    '.cm-gutters': { backgroundColor: '#1d1934', border: 'none', color: '#6f6894' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'rgba(166,139,255,0.08)' },
    '.cm-error-line': { backgroundColor: 'rgba(239,68,68,0.22)' },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: true }
);

const fontTheme = (size) => EditorView.theme({ '&': { fontSize: `${size}px` } });

export default function CodeEditor({ initialValue, onChange, fontSize = 14, errorLine = null, onRun, editorRef }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const fontRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);

  useEffect(() => {
    onChangeRef.current = onChange;
    onRunRef.current = onRun;
  }, [onChange, onRun]);

  // Create the editor once
  useEffect(() => {
    const view = new EditorView({
      doc: initialValue || '',
      parent: hostRef.current,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        Prec.highest(baseTheme), // our colors win over oneDark's background
        fontRef.current.of(fontTheme(fontSize)),
        errorLineField,
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                onRunRef.current?.();
                return true;
              },
            },
          ])
        ),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
        }),
        EditorView.contentAttributes.of({ 'aria-label': 'Code editor' }),
      ],
    });
    viewRef.current = view;

    if (editorRef) {
      editorRef.current = {
        getValue: () => view.state.doc.toString(),
        setValue: (text) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
        insert: (text) => {
          view.dispatch(view.state.replaceSelection(text));
          view.focus();
        },
        focus: () => view.focus(),
        // First syntax error found by the editor's parser (1-based line), or null
        syntaxErrorLine: () => {
          const tree = ensureSyntaxTree(view.state, view.state.doc.length, 200);
          let line = null;
          tree?.iterate({
            enter: (node) => {
              if (line === null && node.type.isError) {
                line = view.state.doc.lineAt(node.from).number;
                return false;
              }
              return line === null;
            },
          });
          return line;
        },
      };
    }
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // initialValue / fontSize are only the starting values; later changes go through effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: fontRef.current.reconfigure(fontTheme(fontSize)) });
  }, [fontSize]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrorLine.of(errorLine) });
  }, [errorLine]);

  return <div ref={hostRef} className="h-full min-h-0 overflow-hidden" />;
}
