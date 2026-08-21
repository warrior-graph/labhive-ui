import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardTitle } from '@angular/material/card';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ArticleService } from '../../../core/services/article.service';
import { ArticleStatus, ARTICLE_STATUS_LABELS } from '../../../core/models';

@Component({
  selector: 'app-article-form',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButton,
    MatCard,
    MatCardTitle,
    MatCardContent,
    MatChipsModule,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    MatIcon,
    MatOption,
    MatProgressSpinner,
    MatSelect,
  ],
  templateUrl: './article-form.html',
  styleUrl: './article-form.scss',
})
export class ArticleForm implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly loading = signal(false);
  protected labId = 0;

  protected readonly statuses = Object.values(ArticleStatus);
  protected readonly statusLabels = ARTICLE_STATUS_LABELS;
  protected readonly separatorKeysCodes = [ENTER, COMMA] as const;

  protected authors: string[] = [];
  protected inCharge: string[] = [];

  protected readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    abstract: [''],
    conference: [''],
    doi: [''],
    status: [ArticleStatus.IN_PROGRESS, Validators.required],
    submission_deadline: [''],
    published_at: [''],
  });

  ngOnInit(): void {
    this.labId = Number(this.route.snapshot.paramMap.get('labId'));
  }

  protected addAuthor(event: MatChipInputEvent): void {
    const name = (event.value || '').trim();
    if (name) this.authors = [...this.authors, name];
    event.chipInput?.clear();
  }

  protected removeAuthor(name: string): void {
    this.authors = this.authors.filter(a => a !== name);
  }

  protected addInCharge(event: MatChipInputEvent): void {
    const name = (event.value || '').trim();
    if (name) this.inCharge = [...this.inCharge, name];
    event.chipInput?.clear();
  }

  protected removeInCharge(name: string): void {
    this.inCharge = this.inCharge.filter(p => p !== name);
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { title, abstract, conference, doi, status, submission_deadline, published_at } =
      this.form.getRawValue();
    this.articleService
      .create(this.labId, {
        title,
        ...(abstract && { abstract }),
        ...(conference && { conference }),
        ...(doi && { doi }),
        status,
        ...(submission_deadline && { submission_deadline }),
        ...(published_at && { published_at }),
        authors: this.authors,
        in_charge: this.inCharge,
      })
      .subscribe({
        next: (_article: any) => {
          this.snackBar.open('Artigo criado', 'Fechar', { duration: 2000 });
          // Redirect back to lab detail on the Articles tab (index 3)
          this.router.navigate(['/labs', this.labId], { queryParams: { tab: 3 } });
        },
        error: (err: HttpErrorResponse) => {
          this.snackBar.open(err.error?.message ?? 'Falha ao criar o artigo', 'Fechar', {
            duration: 3000,
          });
          this.loading.set(false);
        },
      });
  }
}
