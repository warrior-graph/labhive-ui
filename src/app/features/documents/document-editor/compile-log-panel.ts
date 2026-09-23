import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { CompileError } from '../../../core/models';

@Component({
  selector: 'app-compile-log-panel',
  imports: [MatIcon],
  templateUrl: './compile-log-panel.html',
  styleUrl: './compile-log-panel.scss',
})
export class CompileLogPanel {
  readonly log = input<string>('');
  readonly errors = input<CompileError[]>([]);
  readonly compiling = input(false);
  readonly onErrorClick = output<CompileError>();
}
