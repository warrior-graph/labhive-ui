import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import {
  LabMembership,
  LabRole,
  Laboratory,
  Project,
  ProjectStatus,
  Research,
} from '../../../core/models';
import { MemberService } from '../../../core/services/member.service';
import { ProjectService } from '../../../core/services/project.service';
import { ResearchService } from '../../../core/services/research.service';

export interface ProjectFormData {
  labId: number | null;
  project?: Project;
  research?: Research[];
  techLeads?: LabMembership[];
  labs?: Laboratory[];
}

@Component({
  selector: 'app-project-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatProgressSpinner,
  ],
  templateUrl: './project-form-dialog.html',
})
export class ProjectFormDialog implements OnInit {
  readonly dialogRef = inject(MatDialogRef<ProjectFormDialog>);
  readonly data = inject<ProjectFormData>(MAT_DIALOG_DATA);
  private readonly projectService = inject(ProjectService);
  private readonly researchService = inject(ResearchService);
  private readonly memberService = inject(MemberService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly labDataLoading = signal(false);
  protected readonly isEdit = !!this.data.project;

  protected readonly research = signal<Research[]>(this.data.research ?? []);
  protected readonly techLeads = signal<LabMembership[]>(this.data.techLeads ?? []);

  protected readonly statuses = [
    { value: ProjectStatus.PLANNED, label: 'Planned' },
    { value: ProjectStatus.ACTIVE, label: 'Active' },
    { value: ProjectStatus.COMPLETED, label: 'Completed' },
    { value: ProjectStatus.CANCELLED, label: 'Cancelled' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    name: [this.data.project?.name ?? '', Validators.required],
    description: [this.data.project?.description ?? ''],
    status: [this.data.project?.status ?? (ProjectStatus.PLANNED as string)],
    start_date: [
      this.data.project?.start_date ? this.data.project.start_date.slice(0, 10) : '',
    ],
    end_date: [
      this.data.project?.end_date ? this.data.project.end_date.slice(0, 10) : '',
    ],
    research_id: [this.data.project?.research_id ?? (null as number | null)],
    tech_lead_id: [this.data.project?.tech_lead_id ?? (null as number | null)],
    lab_id: [this.data.labId ?? (null as number | null), Validators.required],
  });

  ngOnInit(): void {
    // Criação a partir da lista global: carregar research/techLeads ao trocar de lab.
    if (!this.isEdit && this.data.labId === null) {
      this.form.controls.lab_id.valueChanges.subscribe(id => {
        if (id) this.loadLabData(id);
      });
      return;
    }

    // lab-detail cria com research/techLeads no data; edição carrega se faltarem.
    const labId = this.data.labId;
    if (labId) {
      if ((this.data.research?.length ?? 0) === 0) this.loadResearch(labId);
      if ((this.data.techLeads?.length ?? 0) === 0) this.loadTechLeads(labId);
    }
  }

  protected memberName(m: LabMembership): string {
    const p = m.member;
    return p
      ? [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
      : `Member #${m.member_id}`;
  }

  private loadLabData(labId: number): void {
    this.labDataLoading.set(true);
    forkJoin({
      research: this.researchService.getAll(labId),
      members: this.memberService.getLabMembers(labId),
    }).subscribe({
      next: ({ research, members }) => {
        this.research.set(research);
        this.techLeads.set(this.filterTechLeads(members, labId));
        this.labDataLoading.set(false);
      },
      error: () => {
        this.research.set([]);
        this.techLeads.set([]);
        this.labDataLoading.set(false);
      },
    });
  }

  private loadResearch(labId: number): void {
    this.researchService.getAll(labId).subscribe({
      next: list => this.research.set(list),
      error: () => this.research.set([]),
    });
  }

  private loadTechLeads(labId: number): void {
    this.memberService.getLabMembers(labId).subscribe({
      next: members => this.techLeads.set(this.filterTechLeads(members, labId)),
      error: () => this.techLeads.set([]),
    });
  }

  private filterTechLeads(members: LabMembership[], labId: number): LabMembership[] {
    const leads = members.filter(m => m.roles?.includes(LabRole.TECH_LEAD));
    // Garante que o tech lead atual (edição) apareça no select mesmo se não
    // for mais membro do laboratório.
    const p = this.data.project;
    if (p?.tech_lead_id && !leads.some(m => m.member_id === p.tech_lead_id)) {
      leads.unshift({
        member_id: p.tech_lead_id,
        lab_id: labId,
        roles: [],
        joined_at: '',
        compensation_type: null,
        compensation_value: null,
        member: p.tech_lead ?? undefined,
      } as LabMembership);
    }
    return leads;
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { name, description, status, start_date, end_date, research_id, tech_lead_id, lab_id } =
      this.form.getRawValue();
    const labId = this.data.labId ?? lab_id;
    if (!labId) {
      this.error.set('Select a laboratory.');
      this.loading.set(false);
      return;
    }
    const payload = {
      name,
      ...(tech_lead_id && { tech_lead_id }),
      ...(description && { description }),
      ...(status && { status }),
      ...(start_date && { start_date }),
      ...(end_date && { end_date }),
      ...(research_id && { research_id }),
    };

    const call = this.isEdit
      ? this.projectService.update(labId, this.data.project!.id, payload)
      : this.projectService.create(labId, payload);

    call.subscribe({
      next: project => this.dialogRef.close(project),
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message ?? 'Failed to save project.');
        this.loading.set(false);
      },
    });
  }
}
