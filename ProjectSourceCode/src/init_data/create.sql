-- Drop existing tables (in reverse order of dependencies)
DROP TABLE IF EXISTS session_matches CASCADE;
DROP TABLE IF EXISTS session_swipes CASCADE;
DROP TABLE IF EXISTS session_movies CASCADE;
DROP TABLE IF EXISTS session_participants CASCADE;
DROP TABLE IF EXISTS swipe_sessions CASCADE;
DROP TABLE IF EXISTS liked_movies CASCADE;
DROP TABLE IF EXISTS swipes CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (your existing one)
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL,
    firstName VARCHAR(50) NOT NULL,
    lastName VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    dateOfBirth DATE

      -- NEW: user favorites for profile
    favorite_genre   VARCHAR(100),
    favorite_actor   VARCHAR(100),
    favorite_actress VARCHAR(100)
);

-- User profiles (FIXED: references username now)
CREATE TABLE user_profiles (
    profile_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    bio TEXT,
    profile_picture_url VARCHAR(500),
    favorite_genres TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Watchlist (FIXED: references username now)
CREATE TABLE watchlist (
    watchlist_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    session_id INTEGER,
    UNIQUE(username, movie_id)
);

-- Individual swipes (for discover page solo browsing) (FIXED: removed movies FK)
CREATE TABLE swipes (
    swipe_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('like', 'dislike', 'skip')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (username, movie_id)
);

-- Liked movies (for profile stats)
CREATE TABLE liked_movies (
    like_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    genre VARCHAR(100),
    actor VARCHAR(100),
    actress VARCHAR(100),
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username, movie_id)
);

-- ===== SESSION-BASED SWIPING TABLES =====

-- Swipe sessions
CREATE TABLE swipe_sessions (
    session_id SERIAL PRIMARY KEY,
    session_code VARCHAR(10) UNIQUE NOT NULL,
    created_by VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
    max_participants INTEGER DEFAULT 4,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Session participants
CREATE TABLE session_participants (
    participant_id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES swipe_sessions(session_id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    swipe_completed BOOLEAN DEFAULT FALSE,
    UNIQUE(session_id, username)
);

-- Movies for a specific session
CREATE TABLE session_movies (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES swipe_sessions(session_id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    position INTEGER,
    UNIQUE(session_id, movie_id)
);

-- Individual swipes within a session
CREATE TABLE session_swipes (
    swipe_id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES swipe_sessions(session_id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('like', 'dislike', 'skip')),
    swiped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, username, movie_id)
);

-- Movies that ALL participants liked in a session
CREATE TABLE session_matches (
    match_id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES swipe_sessions(session_id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    match_count INTEGER NOT NULL,
    matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, movie_id)
);