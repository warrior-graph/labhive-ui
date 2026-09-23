import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Compartment, EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import * as Y from 'yjs';
import { yCollab } from 'y-codemirror.next';
import type { Awareness } from 'y-protocols/awareness.js';

@Component({
  selector: 'app-latex-editor',
  imports: [],
  template: `<div #editor class="latex-editor"></div>`,
  styleUrl: './latex-editor.scss',
})
export class LatexEditor {
  private readonly destroyRef = inject(DestroyRef);

  readonly fileId = input.required<number>();
  readonly ytext = input.required<Y.Text>();
  readonly awareness = input.required<Awareness>();
  readonly readOnly = input(false);
  readonly goToLine = input<number | null>(null);

  private editorView: EditorView | null = null;
  private readonly readOnlyCompartment = new Compartment();

  private readonly editorEl = viewChild.required<ElementRef<HTMLDivElement>>('editor');

  constructor() {
    effect(() => {
      const line = this.goToLine();
      if (line !== null && this.editorView) {
        const doc = this.editorView.state.doc;
        const safeLine = Math.max(1, Math.min(line, doc.lines));
        const pos = doc.line(safeLine).from;
        this.editorView.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        });
      }
    });

    effect(() => {
      if (this.editorView) {
        this.editorView.dispatch({
          effects: this.readOnlyCompartment.reconfigure(this.readOnlyExtension()),
        });
      }
    });

    effect(() => {
      // Recreate the editor whenever the file changes so the CodeMirror/Yjs
      // binding is attached to the new Y.Text and Awareness instances.
      this.fileId();
      this.editorView?.destroy();
      this.initEditor();
    });

    this.destroyRef.onDestroy(() => this.editorView?.destroy());
  }

  private readOnlyExtension() {
    return this.readOnly() ? [EditorView.editable.of(false)] : [];
  }

  private initEditor(): void {
    const undoManager = new Y.UndoManager(this.ytext());
    const state = EditorState.create({
      doc: this.ytext().toString(),
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        StreamLanguage.define(stex),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        yCollab(this.ytext(), this.awareness(), { undoManager }),
        this.readOnlyCompartment.of(this.readOnlyExtension()),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    });

    this.editorView = new EditorView({
      state,
      parent: this.editorEl().nativeElement,
    });
  }
}
