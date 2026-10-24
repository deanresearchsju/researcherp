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
          school: string;
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
          school?: string;
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
          school?: string;
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
          applicant_name?: string;
          email?: string;
          study_mode?: string;
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
          token: string;
          follow_note: string;
          followed_at: string | null;
          updated_at: string;
        };
        Insert: {
          mobile: string;
          email: string;
          department: string;
          step?: number;
          payload: Json;
          token: string;
          follow_note?: string;
          followed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          email?: string;
          department?: string;
          step?: number;
          payload?: Json;
          token?: string;
          follow_note?: string;
          followed_at?: string | null;
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
          must_reset: boolean;
          menu_rights: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          role: string;
          name: string;
          identifier: string;
          password: string;
          must_reset?: boolean;
          menu_rights?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          password?: string;
          must_reset?: boolean;
          menu_rights?: Json | null;
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
          email: string;
          phone: string;
          photo: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sort_order: number;
          role: string;
          name?: string;
          email?: string;
          phone?: string;
          photo?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          sort_order?: number;
          role?: string;
          name?: string;
          email?: string;
          phone?: string;
          photo?: string;
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
          remarks?: string;
          agenda?: string;
          attendance?: string;
          minutes?: string;
          reason?: string;
          decided_on?: string;
          decided_by?: string;
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
          remarks?: string;
          agenda?: string;
          attendance?: string;
          minutes?: string;
          reason?: string;
          decided_on?: string;
          decided_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          nominees?: Json;
          selected_internal?: string;
          selected_external?: string;
          remarks?: string;
          agenda?: string;
          attendance?: string;
          minutes?: string;
          reason?: string;
          decided_on?: string;
          decided_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      doctoral_office: {
        Row: { id: string; payload: Json; updated_at: string };
        Insert: { id: string; payload: Json; updated_at?: string };
        Update: { payload?: Json; updated_at?: string };
        Relationships: [];
      };
      exam_office: {
        Row: { id: string; payload: Json; updated_at: string };
        Insert: { id: string; payload: Json; updated_at?: string };
        Update: { payload?: Json; updated_at?: string };
        Relationships: [];
      };
      research_register: {
        Row: { id: string; payload: Json; updated_at: string };
        Insert: { id: string; payload: Json; updated_at?: string };
        Update: { payload?: Json; updated_at?: string };
        Relationships: [];
      };
      news_board: {
        Row: { id: string; payload: Json; updated_at: string };
        Insert: { id: string; payload: Json; updated_at?: string };
        Update: { payload?: Json; updated_at?: string };
        Relationships: [];
      };
      research_areas: {
        Row: { id: string; payload: Json; updated_at: string };
        Insert: { id: string; payload: Json; updated_at?: string };
        Update: { payload?: Json; updated_at?: string };
        Relationships: [];
      };
      profile_photos: {
        Row: { id: string; photo: string; updated_at: string };
        Insert: { id: string; photo: string; updated_at?: string };
        Update: { photo?: string; updated_at?: string };
        Relationships: [];
      };
      admission_office: {
        Row: { id: string; payload: Json; updated_at: string };
        Insert: { id: string; payload: Json; updated_at?: string };
        Update: { payload?: Json; updated_at?: string };
        Relationships: [];
      };
      thesis_evaluation: {
        Row: {
          scholar_key: string;
          scholar_identifier: string;
          scholar_name: string;
          supervisor_identifier: string;
          supervisor_name: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          scholar_key: string;
          scholar_identifier: string;
          scholar_name?: string;
          supervisor_identifier?: string;
          supervisor_name?: string;
          payload?: Json;
          updated_at?: string;
        };
        Update: {
          scholar_name?: string;
          supervisor_identifier?: string;
          supervisor_name?: string;
          payload?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      portal_forms: {
        Row: {
          id: string;
          title: string;
          category: string;
          audience: string[];
          file_name: string;
          file_type: string;
          file_size: number;
          file_data: string;
          complete: boolean;
          uploaded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category?: string;
          audience?: string[];
          file_name: string;
          file_type: string;
          file_size?: number;
          file_data: string;
          complete?: boolean;
          uploaded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          category?: string;
          audience?: string[];
          file_name?: string;
          file_type?: string;
          file_size?: number;
          file_data?: string;
          complete?: boolean;
          uploaded_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      thesis_panels: {
        Row: { id: string; payload: Json; updated_at: string };
        Insert: { id: string; payload: Json; updated_at?: string };
        Update: { payload?: Json; updated_at?: string };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          at: string;
          actor_role: string;
          actor_identifier: string;
          action: string;
          subject: string;
          detail: string;
        };
        Insert: {
          id?: string;
          at?: string;
          actor_role: string;
          actor_identifier: string;
          action: string;
          subject: string;
          detail?: string;
        };
        Update: {
          detail?: string;
        };
        Relationships: [];
      };
      portal_notices: {
        Row: {
          id: string;
          created_at: string;
          role: string;
          identifier: string;
          title: string;
          detail: string;
          href: string;
          read_by: string[];
        };
        Insert: {
          id?: string;
          created_at?: string;
          role: string;
          identifier: string;
          title: string;
          detail?: string;
          href?: string;
          read_by?: string[];
        };
        Update: {
          title?: string;
          detail?: string;
          href?: string;
          read_by?: string[];
        };
        Relationships: [];
      };
      helpdesk_messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          subject: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone: string;
          subject: string;
          message: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          email?: string;
          phone?: string;
          subject?: string;
          message?: string;
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
          applicant_name?: string;
          email?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      issue_application_no: {
        Args: { p_kind: string; p_year: string };
        Returns: string;
      };
      issue_application_number: {
        Args: { p_kind: string; p_year: string; p_code: string };
        Returns: string;
      };
      submit_phd_application: {
        Args: {
          p_date_of_birth: string;
          p_applicant_name: string;
          p_email: string;
          p_study_mode: string;
          p_year: string;
          p_code: string;
          p_payload: Json;
        };
        Returns: string;
      };
      upsert_phd_draft: {
        Args: {
          p_token: string;
          p_mobile: string;
          p_email: string;
          p_department: string;
          p_step: number;
          p_payload: Json;
        };
        Returns: undefined;
      };
      get_phd_draft: {
        Args: { p_token: string };
        Returns: Json | null;
      };
      delete_phd_draft: {
        Args: { p_token: string };
        Returns: undefined;
      };
      list_phd_drafts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          mobile: string;
          email: string;
          department: string;
          step: number;
          payload: Json;
          updated_at: string;
          follow_note: string;
          followed_at: string | null;
        }[];
      };
      update_phd_draft_follow: {
        Args: { p_mobile: string; p_note: string; p_followed: boolean };
        Returns: undefined;
      };
      delete_phd_draft_office: {
        Args: { p_mobile: string };
        Returns: undefined;
      };
      save_json_blob: {
        Args: {
          p_table: string;
          p_id: string;
          p_payload: Json;
          p_updated_at: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
