export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      media_library: {
        Row: {
          id: string
          drive_file_id: string
          title: string
          series: string | null
          season: number | null
          episode: number | null
          media_type: "movie" | "tv-show" | "anime"
          poster_url: string | null
          backdrop_url: string | null
          runtime: number | null
          file_size: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          drive_file_id: string
          title: string
          series?: string | null
          season?: number | null
          episode?: number | null
          media_type: "movie" | "tv-show" | "anime"
          poster_url?: string | null
          backdrop_url?: string | null
          runtime?: number | null
          file_size?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          drive_file_id?: string
          title?: string
          series?: string | null
          season?: number | null
          episode?: number | null
          media_type?: "movie" | "tv-show" | "anime"
          poster_url?: string | null
          backdrop_url?: string | null
          runtime?: number | null
          file_size?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      user_progress: {
        Row: {
          id: string
          profile_id: string
          media_id: string
          playback_position: number
          completed: boolean
          last_watched: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          media_id: string
          playback_position?: number
          completed?: boolean
          last_watched?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          media_id?: string
          playback_position?: number
          completed?: boolean
          last_watched?: string
          created_at?: string
          updated_at?: string
        }
      }
      intro_meta: {
        Row: {
          id: string
          media_id: string
          intro_start: number
          intro_end: number
          updated_at: string
        }
        Insert: {
          id?: string
          media_id: string
          intro_start: number
          intro_end: number
          updated_at?: string
        }
        Update: {
          id?: string
          media_id?: string
          intro_start?: number
          intro_end?: number
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
