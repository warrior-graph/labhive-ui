import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption } from '@angular/material/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';

import { LAB_ROLE_LABELS, LabMembership, LabRole, Laboratory, Member } from '../../core/models';
import { AuthService } from '../../core/auth/auth.service';
import { LaboratoryService } from '../../core/services/laboratory.service';
import { MemberService } from '../../core/services/member.service';

export interface ManageLabsData {
  member: Member;
}

@Component({
  selector: 'app-manage-labs-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButton,
    MatIconButton,
    MatDivider,
    MatFormField,
    MatLabel,
    MatIcon,
    MatOption,
    MatProgressSpinner,
    MatSelect,
    MatTooltip,
  ],
  template: `
    <h2 mat-dialog-title>
      Gerenciar laboratórios — {{ data.member.first_name }} {{ data.member.last_name }}
    </h2>
    <mat-dialog-content>
      @if (loading()) {
        <div class="dialog-center">
          <mat-progress-spinner mode="indeterminate" diameter="36" />
        </div>
      } @else {
        <p class="section-label">Associações atuais</p>
        @if (memberships().length === 0) {
          <p class="empty-text">Nenhuma associação a laboratório ainda.</p>
        } @else {
          @for (m of memberships(); track m.lab_id) {
            <div class="membership-row">
              <span class="lab-name">{{ m.laboratory?.name ?? 'Laboratório #' + m.lab_id }}</span>
              <span class="role-badge">{{ m.roles.map(roleLabel).join(', ') }}</span>
              <button mat-icon-button color="warn"
                [matTooltip]="isSelf() ? 'Não é possível alterar sua própria associação' : 'Remover deste laboratório'"
                (click)="remove(m)" [disabled]="removing().has(m.lab_id) || isSelf()">
                @if (removing().has(m.lab_id)) {
                  <mat-progress-spinner diameter="18" mode="indeterminate" />
                } @else {
                  <mat-icon>close</mat-icon>
                }
              </button>
            </div>
          }
        }

        <mat-divider class="divider" />

        <p class="section-label">Adicionar ao laboratório</p>
        <form [formGroup]="addForm" (ngSubmit)="add()" class="add-form">
          <mat-form-field appearance="outline">
            <mat-label>Laboratório</mat-label>
            <mat-select formControlName="lab_id">
              @if (availableLabs().length === 0) {
                <mat-option disabled>O membro já está em todos os laboratórios</mat-option>
              }
              @for (lab of availableLabs(); track lab.id) {
                <mat-option [value]="lab.id">{{ lab.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Papel</mat-label>
            <mat-select formControlName="roles" multiple>
              @for (r of roles; track r.value) {
                <mat-option [value]="r.value">{{ r.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <button mat-raised-button color="primary" type="submit"
            [disabled]="addForm.invalid || adding() || availableLabs().length === 0">
            @if (adding()) {
              <mat-progress-spinner diameter="18" mode="indeterminate" />
            } @else {
              Adicionar ao laboratório
            }
          </button>
        </form>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">Fechar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-center { display: flex; justify-content: center; padding: 32px 0; }
    .section-label {
      margin: 0 0 10px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--mat-sys-on-surface-variant);
    }
    .membership-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 0;
    }
    .lab-name { flex: 1; font-size: 14px; font-weight: 500; }
    .role-badge {
      font-size: 12px;
      padding: 2px 10px;
      border-radius: 12px;
    }
    .empty-text { color: var(--mat-sys-on-surface-variant); font-size: 14px; margin: 0 0 12px; }
    .divider { margin: 16px 0; }
    .add-form { display: flex; flex-direction: column; gap: 4px; }
    mat-form-field { width: 100%; }
  `],
})
export class ManageLabsDialog implements OnInit {
  protected readonly data = inject<ManageLabsData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ManageLabsDialog>);
  private readonly authService = inject(AuthService);
  private readonly memberService = inject(MemberService);
  private readonly labService = inject(LaboratoryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  protected readonly memberships = signal<LabMembership[]>([]);
  protected readonly allLabs = signal<Laboratory[]>([]);
  protected readonly loading = signal(true);
  protected readonly removing = signal<Set<number>>(new Set());
  protected readonly adding = signal(false);

  protected readonly availableLabs = computed(() => {
    const memberLabIds = new Set(this.memberships().map(m => m.lab_id));
    return this.allLabs().filter(l => !memberLabIds.has(l.id));
  });

  protected readonly roles = Object.entries(LAB_ROLE_LABELS).map(([value, label]) => ({ value, label }));

  protected readonly addForm = this.fb.nonNullable.group({
    lab_id: [null as number | null, Validators.required],
    roles: [[LabRole.RESEARCHER as string], Validators.required],
  });

  ngOnInit(): void {
    this.memberService.getMemberById(this.data.member.id).subscribe({
      next: member => {
        this.memberships.set(member.lab_memberships ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.labService.getAll().subscribe({
      next: labs => this.allLabs.set(labs),
    });
  }

  protected roleLabel(role: LabRole | string): string {
    return LAB_ROLE_LABELS[role as LabRole] ?? role;
  }

  protected isSelf(): boolean {
    return this.data.member.id === this.authService.currentUser()?.id;
  }

  protected remove(membership: LabMembership): void {
    this.removing.update(s => { const n = new Set(s); n.add(membership.lab_id); return n; });
    this.memberService.removeMember(membership.lab_id, this.data.member.id).subscribe({
      next: () => {
        this.memberships.update(list => list.filter(m => m.lab_id !== membership.lab_id));
        this.removing.update(s => { const n = new Set(s); n.delete(membership.lab_id); return n; });
        this.snackBar.open('Removido do laboratório.', 'Fechar', { duration: 3000 });
      },
      error: () => {
        this.removing.update(s => { const n = new Set(s); n.delete(membership.lab_id); return n; });
        this.snackBar.open('Falha ao remover do laboratório.', 'Fechar', { duration: 3000 });
      },
    });
  }

  protected add(): void {
    if (this.addForm.invalid) return;
    const { lab_id, roles } = this.addForm.getRawValue();
    if (!lab_id) return;
    this.adding.set(true);
    this.memberService.addMember(lab_id, { member_id: this.data.member.id, roles }).subscribe({
      next: membership => {
        this.memberships.update(list => [...list, membership]);
        this.adding.set(false);
        this.addForm.patchValue({ lab_id: null });
        this.snackBar.open('Adicionado ao laboratório.', 'Fechar', { duration: 3000 });
      },
      error: () => {
        this.adding.set(false);
        this.snackBar.open('Falha ao adicionar ao laboratório.', 'Fechar', { duration: 3000 });
      },
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
