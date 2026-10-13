export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      supervisor_vacancies: {
        Row: {
          id: string;
          serial_no: number;
          supervisor_name: string;
          designation: string;
          department: string;
          research_area: string;
          vacancy_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          serial_no: number;
          supervisor_name: string;
          designation: string;
          department: string;
          research_area: string;
          vacancy_count: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          serial_no?: number;
          supervisor_name?: string;
          designation?: string;
          department?: string;
          research_area?: string;
          vacancy_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      phd_applications: {
        Row: {
          id: string;
          application_no: string;
          date_of_birth: string;
          applicant_name: string;
          email: string;
          study_mode: string;
          status: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          application_no: string;
          date_of_birth: string;
          applicant_name: string;
          email: string;
          study_mode: string;
          status?: string;
          payload: Json;
          created_at?: string;
        };
        Update: {
          status?: string;
          payload?: Json;
        };
        Relationships: [];
      };
      phd_drafts: {
        Row: {
          mobile: string;
          email: string;
          department: string;
          step: number;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          mobile: string;
          email: string;
          department: string;
          step?: number;
          payload: Json;
          updated_at?: string;
        };
        Update: {
          email?: string;
          department?: string;
          step?: number;
          payload?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      scholar_records: {
        Row: {
          id: string;
          kind: string;
          scholar_identifier: string;
          scholar_name: string;
          status: string;
          payload: Json;
          file_name: string | null;
          file_data: string | null;
          supervisor_identifier: string;
          supervisor_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          scholar_identifier: string;
          scholar_name: string;
          status?: string;
          payload: Json;
          file_name?: string | null;
          file_data?: string | null;
          supervisor_identifier?: string;
          supervisor_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          scholar_name?: string;
          status?: string;
          payload?: Json;
          file_name?: string | null;
          file_data?: string | null;
          supervisor_identifier?: string;
          supervisor_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      portal_users: {
        Row: {
          id: string;
          role: string;
          name: string;
          identifier: string;
          password: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          role: string;
          name: string;
          identifier: string;
          password: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          password?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      research_team: {
        Row: {
          id: string;
          sort_order: number;
          role: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sort_order: number;
          role: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          sort_order?: number;
          role?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          id: string;
          hero_eyebrow: string;
          hero_title: string;
          hero_summary: string;
          admission_label: string;
          admission_session: string;
          deadline_label: string;
          deadline: string;
          phd_open: boolean;
          supervisor_open: boolean;
          updated_at: string;
        };
        Insert: {
          id: string;
          hero_eyebrow: string;
          hero_title: string;
          hero_summary: string;
          admission_label: string;
          admission_session: string;
          deadline_label: string;
          deadline: string;
          phd_open?: boolean;
          supervisor_open?: boolean;
          updated_at?: string;
        };
        Update: {
          hero_eyebrow?: string;
          hero_title?: string;
          hero_summary?: string;
          admission_label?: string;
          admission_session?: string;
          deadline_label?: string;
          deadline?: string;
          phd_open?: boolean;
          supervisor_open?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      scholar_allocations: {
        Row: {
          id: string;
          scholar_identifier: string;
          scholar_name: string;
          supervisor_identifier: string;
          supervisor_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scholar_identifier: string;
          scholar_name: string;
          supervisor_identifier: string;
          supervisor_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          scholar_name?: string;
          supervisor_identifier?: string;
          supervisor_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rac_proposals: {
        Row: {
          id: string;
          kind: string;
          scholar_identifier: string;
          scholar_name: string;
          supervisor_identifier: string;
          supervisor_name: string;
          status: string;
          nominees: Json;
          selected_internal: string;
          selected_external: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          scholar_identifier: string;
          scholar_name: string;
          supervisor_identifier: string;
          supervisor_name: string;
          status?: string;
          nominees: Json;
          selected_internal?: string;
          selected_external?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          nominees?: Json;
          selected_internal?: string;
          selected_external?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      supervisor_applications: {
        Row: {
          id: string;
          application_no: string;
          date_of_birth: string;
          applicant_name: string;
          email: string;
          status: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          application_no: string;
          date_of_birth: string;
          applicant_name: string;
          email: string;
          status?: string;
          payload: Json;
          created_at?: string;
        };
        Update: {
          status?: string;
          payload?: Json;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
