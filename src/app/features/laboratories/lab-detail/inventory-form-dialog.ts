import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  InventoryItem,
  ItemCondition,
  ITEM_CONDITION_LABELS,
  LabMembership,
  Laboratory,
} from '../../../core/models';
import { InventoryService, CreateInventoryItemPayload } from '../../../core/services/inventory.service';
import { MemberService } from '../../../core/services/member.service';

export interface InventoryFormData {
  labId: number | null;
  item?: InventoryItem;
  labs?: Laboratory[];
}

@Component({
  selector: 'app-inventory-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    MatOption,
    MatSelect,
  ],
  templateUrl: './inventory-form-dialog.html',
})
export class InventoryFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<InventoryFormDialog>);
  readonly data = inject<InventoryFormData>(MAT_DIALOG_DATA);
  private readonly inventoryService = inject(InventoryService);
  private readonly memberService = inject(MemberService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly conditions = Object.values(ItemCondition);
  protected readonly conditionLabels = ITEM_CONDITION_LABELS;
  protected readonly isEdit = !!this.data.item;

  protected readonly labMembers = signal<LabMembership[]>([]);
  protected readonly membersLoading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    category: ['', Validators.required],
    description: [''],
    serial_number: [''],
    quantity: [1, [Validators.required, Validators.min(1)]],
    condition: [ItemCondition.GOOD, Validators.required],
    assigned_to_id: [null as number | null],
    lab_id: [this.data.labId ?? (null as number | null), Validators.required],
  });

  ngOnInit(): void {
    if (this.isEdit && this.data.item) {
      const i = this.data.item;
      this.form.patchValue({
        name: i.name,
        category: i.category,
        description: i.description ?? '',
        serial_number: i.serial_number ?? '',
        quantity: i.quantity,
        condition: i.condition,
        assigned_to_id: i.assigned_to_id,
      });
    }

    // Criação a partir da lista global: lab escolhido no select carrega os membros.
    if (!this.isEdit && this.data.labId === null) {
      this.form.controls.lab_id.valueChanges.subscribe(id => {
        if (id) this.loadLabMembers(id);
      });
      return;
    }

    const labId = this.data.labId;
    if (labId) this.loadLabMembers(labId);
  }

  protected memberName(m: LabMembership): string {
    const p = m.member;
    return p
      ? [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
      : `Membro #${m.member_id}`;
  }

  private loadLabMembers(labId: number): void {
    this.membersLoading.set(true);
    this.memberService.getLabMembers(labId).subscribe({
      next: list => {
        let members = list;
        // Garante que o responsável atual (edição) apareça no select mesmo se
        // não for mais membro do laboratório.
        const item = this.data.item;
        if (item?.assigned_to_id && !members.some(m => m.member_id === item.assigned_to_id)) {
          members = [
            {
              member_id: item.assigned_to_id,
              lab_id: labId,
              roles: [],
              joined_at: '',
              compensation_type: null,
              compensation_value: null,
              member: item.assigned_to ?? undefined,
            } as LabMembership,
            ...members,
          ];
        }
        this.labMembers.set(members);
        this.membersLoading.set(false);
      },
      error: () => {
        this.labMembers.set([]);
        this.membersLoading.set(false);
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const labId = this.data.labId ?? raw.lab_id;
    if (!labId) {
      this.snackBar.open('Selecione um laboratório primeiro', 'Fechar', { duration: 3000 });
      return;
    }
    const payload: CreateInventoryItemPayload = {
      name: raw.name,
      category: raw.category,
      ...(raw.description && { description: raw.description }),
      ...(raw.serial_number && { serial_number: raw.serial_number }),
      quantity: raw.quantity,
      condition: raw.condition,
      assigned_to_id: raw.assigned_to_id ?? null,
    };

    const call = this.isEdit
      ? this.inventoryService.update(labId, this.data.item!.id, payload)
      : this.inventoryService.create(labId, payload);

    call.subscribe({
      next: item => this.dialogRef.close(item),
      error: err =>
        this.snackBar.open(err.error?.message ?? 'Falha ao salvar o item', 'Fechar', {
          duration: 3000,
        }),
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
