export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      caderno_erro_temas: {
        Row: {
          caderno_erro_id: string
          tema_id: string
        }
        Insert: {
          caderno_erro_id: string
          tema_id: string
        }
        Update: {
          caderno_erro_id?: string
          tema_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caderno_erro_temas_caderno_erro_id_fkey"
            columns: ["caderno_erro_id"]
            isOneToOne: false
            referencedRelation: "caderno_erros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caderno_erro_temas_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
        ]
      }
      caderno_erros: {
        Row: {
          codigo_referencia: string | null
          created_at: string
          enunciado_completo: string | null
          id: string
          last_review_mode:
            | Database["public"]["Enums"]["review_mode_enum"]
            | null
          last_reviewed_at: string | null
          link_externo: string | null
          lousa_id: string | null
          observacao_erro: string | null
          origem: Database["public"]["Enums"]["erro_origem_enum"]
          simulado_questao_id: string | null
          status: Database["public"]["Enums"]["erro_status_enum"]
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          codigo_referencia?: string | null
          created_at?: string
          enunciado_completo?: string | null
          id?: string
          last_review_mode?:
            | Database["public"]["Enums"]["review_mode_enum"]
            | null
          last_reviewed_at?: string | null
          link_externo?: string | null
          lousa_id?: string | null
          observacao_erro?: string | null
          origem: Database["public"]["Enums"]["erro_origem_enum"]
          simulado_questao_id?: string | null
          status?: Database["public"]["Enums"]["erro_status_enum"]
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          codigo_referencia?: string | null
          created_at?: string
          enunciado_completo?: string | null
          id?: string
          last_review_mode?:
            | Database["public"]["Enums"]["review_mode_enum"]
            | null
          last_reviewed_at?: string | null
          link_externo?: string | null
          lousa_id?: string | null
          observacao_erro?: string | null
          origem?: Database["public"]["Enums"]["erro_origem_enum"]
          simulado_questao_id?: string | null
          status?: Database["public"]["Enums"]["erro_status_enum"]
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caderno_erros_lousa_id_fkey"
            columns: ["lousa_id"]
            isOneToOne: false
            referencedRelation: "lousas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caderno_erros_simulado_questao_id_fkey"
            columns: ["simulado_questao_id"]
            isOneToOne: true
            referencedRelation: "simulado_questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      lousas: {
        Row: {
          created_at: string
          id: string
          preview_mime_type: string
          preview_size_bytes: number
          preview_storage_path: string
          scene_size_bytes: number
          scene_storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preview_mime_type: string
          preview_size_bytes: number
          preview_storage_path: string
          scene_size_bytes: number
          scene_storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preview_mime_type?: string
          preview_size_bytes?: number
          preview_storage_path?: string
          scene_size_bytes?: number
          scene_storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reflexao_temas_conectados: {
        Row: {
          reflexao_id: string
          tema_conectado_id: string
        }
        Insert: {
          reflexao_id: string
          tema_conectado_id: string
        }
        Update: {
          reflexao_id?: string
          tema_conectado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflexao_temas_conectados_reflexao_id_fkey"
            columns: ["reflexao_id"]
            isOneToOne: false
            referencedRelation: "reflexoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reflexao_temas_conectados_tema_conectado_id_fkey"
            columns: ["tema_conectado_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
        ]
      }
      reflexoes: {
        Row: {
          conteudo: string | null
          created_at: string
          id: string
          lousa_id: string | null
          tema_principal_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          id?: string
          lousa_id?: string | null
          tema_principal_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          id?: string
          lousa_id?: string | null
          tema_principal_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflexoes_lousa_id_fkey"
            columns: ["lousa_id"]
            isOneToOne: false
            referencedRelation: "lousas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reflexoes_tema_principal_id_fkey"
            columns: ["tema_principal_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
        ]
      }
      simulado_pensamentos: {
        Row: {
          created_at: string
          descricao: string
          id: string
          simulado_questao_id: string
          tempo_decorrido_segundos: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          simulado_questao_id: string
          tempo_decorrido_segundos?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          simulado_questao_id?: string
          tempo_decorrido_segundos?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulado_pensamentos_simulado_questao_id_fkey"
            columns: ["simulado_questao_id"]
            isOneToOne: false
            referencedRelation: "simulado_questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      simulado_questao_temas: {
        Row: {
          simulado_questao_id: string
          tema_id: string
        }
        Insert: {
          simulado_questao_id: string
          tema_id: string
        }
        Update: {
          simulado_questao_id?: string
          tema_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulado_questao_temas_simulado_questao_id_fkey"
            columns: ["simulado_questao_id"]
            isOneToOne: false
            referencedRelation: "simulado_questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulado_questao_temas_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
        ]
      }
      simulado_questoes: {
        Row: {
          created_at: string
          id: string
          numero_questao: string
          observacao_pos_revisao: string | null
          ordem: number
          resultado:
            | Database["public"]["Enums"]["questao_resultado_enum"]
            | null
          simulado_id: string
          titulo_questao: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          numero_questao: string
          observacao_pos_revisao?: string | null
          ordem?: number
          resultado?:
            | Database["public"]["Enums"]["questao_resultado_enum"]
            | null
          simulado_id: string
          titulo_questao: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          numero_questao?: string
          observacao_pos_revisao?: string | null
          ordem?: number
          resultado?:
            | Database["public"]["Enums"]["questao_resultado_enum"]
            | null
          simulado_id?: string
          titulo_questao?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulado_questoes_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      simulados: {
        Row: {
          created_at: string
          duracao_configurada_segundos: number
          finished_at: string | null
          id: string
          pdf_storage_path: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["simulado_status_enum"]
          tempo_gasto_segundos: number
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duracao_configurada_segundos: number
          finished_at?: string | null
          id?: string
          pdf_storage_path?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["simulado_status_enum"]
          tempo_gasto_segundos?: number
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duracao_configurada_segundos?: number
          finished_at?: string | null
          id?: string
          pdf_storage_path?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["simulado_status_enum"]
          tempo_gasto_segundos?: number
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      temas: {
        Row: {
          created_at: string
          id: string
          last_review_mode:
            | Database["public"]["Enums"]["review_mode_enum"]
            | null
          last_reviewed_at: string | null
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_review_mode?:
            | Database["public"]["Enums"]["review_mode_enum"]
            | null
          last_reviewed_at?: string | null
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_review_mode?:
            | Database["public"]["Enums"]["review_mode_enum"]
            | null
          last_reviewed_at?: string | null
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rpc_classificar_questao_simulado: {
        Args: {
          p_observacao_pos_revisao?: string
          p_resultado: Database["public"]["Enums"]["questao_resultado_enum"]
          p_simulado_questao_id: string
          p_tema_ids: string[]
        }
        Returns: undefined
      }
      rpc_concluir_revisao_erro: {
        Args: {
          p_caderno_erro_id: string
          p_review_mode: Database["public"]["Enums"]["review_mode_enum"]
        }
        Returns: undefined
      }
      rpc_devolver_erro_para_pendente: {
        Args: { p_caderno_erro_id: string }
        Returns: undefined
      }
      rpc_registrar_pratica_temas: {
        Args: {
          p_review_mode: Database["public"]["Enums"]["review_mode_enum"]
          p_tema_ids: string[]
        }
        Returns: undefined
      }
    }
    Enums: {
      erro_origem_enum: "SIMULADO" | "EXTERNAL_LINK" | "GENERIC_FULL"
      erro_status_enum: "PENDENTE" | "REVISADO"
      questao_resultado_enum: "ACERTEI" | "PARCIAL" | "ERREI"
      review_mode_enum: "SOLO" | "HELP"
      simulado_status_enum: "PREPARACAO" | "EM_ANDAMENTO" | "FINALIZADO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      erro_origem_enum: ["SIMULADO", "EXTERNAL_LINK", "GENERIC_FULL"],
      erro_status_enum: ["PENDENTE", "REVISADO"],
      questao_resultado_enum: ["ACERTEI", "PARCIAL", "ERREI"],
      review_mode_enum: ["SOLO", "HELP"],
      simulado_status_enum: ["PREPARACAO", "EM_ANDAMENTO", "FINALIZADO"],
    },
  },
} as const
