import { DatePipe } from '@angular/common';
import { Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardTitle } from '@angular/material/card';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';

import { Article, ArticleStatus, ARTICLE_STATUS_LABELS } from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { ArticleService } from '../../../core/services/article.service';

@Component({
  selector: 'app-article-detail',
  encapsulation: ViewEncapsulation.None,
  imports: [
    RouterLink,
    DatePipe,
    ReactiveFormsModule,
    MatButton,
    MatIconButton,
    MatCard,
    MatCardContent,
    MatCardTitle,
    MatIcon,
    MatProgressSpinner,
    MatDivider,
    MatTooltip,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    MatOption,
    MatSelect,
    MatChipsModule,
  ],
  templateUrl: './article-detail.html',
  styleUrl: './article-detail.scss',
})
export class ArticleDetail implements OnInit {
  protected readonly article = signal<Article | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly editMode = signal(false);

  protected readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly articleService = inject(ArticleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  protected labId = 0;
  protected articleId = 0;

  protected readonly statusLabels = ARTICLE_STATUS_LABELS;
  protected readonly statuses = Object.values(ArticleStatus);
  protected readonly separatorKeysCodes = [ENTER, COMMA] as const;

  // Edit state for chip arrays
  protected editAuthors: string[] = [];
  protected editInCharge: string[] = [];

  protected readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    abstract: [''],
    conference: [''],
    doi: [''],
    status: [ArticleStatus.IN_PROGRESS as ArticleStatus, Validators.required],
    submission_deadline: [''],
    published_at: [''],
  });

  ngOnInit(): void {
    this.labId = Number(this.route.snapshot.paramMap.get('labId'));
    this.articleId = Number(this.route.snapshot.paramMap.get('articleId'));
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.articleService.getById(this.labId, this.articleId).subscribe({
      next: (a: Article) => {
        this.article.set(a);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Artigo não encontrado', 'Fechar', { duration: 3000 });
        this.router.navigate(['/labs', this.labId], { queryParams: { tab: 3 } });
      },
    });
  }

  protected startEdit(): void {
    const a = this.article()!;
    this.form.patchValue({
      title: a.title,
      abstract: a.abstract ?? '',
      conference: a.conference ?? '',
      doi: a.doi ?? '',
      status: a.status,
      submission_deadline: a.submission_deadline ?? '',
      published_at: a.published_at ?? '',
    });
    this.editAuthors = [...(a.authors ?? [])];
    this.editInCharge = [...(a.in_charge ?? [])];
    this.editMode.set(true);
  }

  protected cancelEdit(): void {
    this.editMode.set(false);
  }

  protected saveEdit(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const raw = this.form.getRawValue();
    this.articleService.update(this.labId, this.articleId, {
      title: raw.title,
      abstract: raw.abstract || undefined,
      conference: raw.conference || undefined,
      doi: raw.doi || undefined,
      status: raw.status,
      submission_deadline: raw.submission_deadline || undefined,
      published_at: raw.published_at || undefined,
      authors: this.editAuthors,
      in_charge: this.editInCharge,
    }).subscribe({
      next: (updated: Article) => {
        this.article.set(updated);
        this.saving.set(false);
        this.editMode.set(false);
        this.snackBar.open('Artigo atualizado', 'Fechar', { duration: 2000 });
      },
      error: (err: any) => {
        this.saving.set(false);
        this.snackBar.open(err.error?.message ?? 'Falha ao atualizar o artigo', 'Fechar', {
          duration: 3000,
        });
      },
    });
  }

  // ── Chip helpers for edit mode ────────────────────────────────────────────

  protected addEditAuthor(event: MatChipInputEvent): void {
    const name = (event.value || '').trim();
    if (name) this.editAuthors = [...this.editAuthors, name];
    event.chipInput?.clear();
  }

  protected removeEditAuthor(name: string): void {
    this.editAuthors = this.editAuthors.filter((a: string) => a !== name);
  }

  protected addEditInCharge(event: MatChipInputEvent): void {
    const name = (event.value || '').trim();
    if (name) this.editInCharge = [...this.editInCharge, name];
    event.chipInput?.clear();
  }

  protected removeEditInCharge(name: string): void {
    this.editInCharge = this.editInCharge.filter((p: string) => p !== name);
  }
}
