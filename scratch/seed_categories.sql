-- Run this in Supabase SQL Editor to seed initial categories
INSERT INTO categories (name, slug, icon, color, "order") VALUES
('Sound Effects', 'sound-effects', 'volume-2', '#FFD93D', 1),
('Music', 'music', 'music', '#FF6B6B', 2),
('Video Meme', 'video-meme', 'film', '#6C5CE7', 3),
('Green Screen', 'green-screen', 'monitor', '#1DD1A1', 4),
('Animation', 'animation', 'sparkles', '#FF9F43', 5),
('Image & Overlay', 'image-overlay', 'image', '#A55EE1', 6),
('Font', 'font', 'type', '#00D2D3', 7),
('Preset & LUT', 'preset-lut', 'sliders', '#54A0FF', 8);
