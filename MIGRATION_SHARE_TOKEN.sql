-- Migration to add share_token column to projects table
-- Execute this in your Supabase database to enable the share link feature

ALTER TABLE projects ADD COLUMN share_token TEXT UNIQUE;

-- Optional: Add an index for faster lookups by share_token
CREATE INDEX idx_projects_share_token ON projects(share_token);
