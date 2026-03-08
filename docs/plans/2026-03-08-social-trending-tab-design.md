# Social Trending Tab Design

**Goal:** Add an AI-powered trending research tab to the social module where users search a topic/niche and get back trending topics, hashtags, and content ideas they can bookmark or send directly to the Create tab.

## Architecture

Search-first UI powered by LLM. User enters a topic and optional platform filter, backend calls LLM with a structured prompt, returns 5-8 trend cards with actionable data. Individual trends can be bookmarked to a SQLite table for later reference.

## Frontend

- New "Trending" tab in social layout (icon: TrendingUp, between Dashboard and Calendar)
- Search bar: text input + platform selector (all/instagram/x/youtube) + Search button
- Results: card list, each card has:
  - Trend title (bold) + relevance tag ("Hot", "Rising", "Emerging")
  - Why it's trending (1-2 sentences)
  - Suggested hashtags (clickable chips, copy on click)
  - 2-3 content ideas as bullets
  - Action row: "Create Post" button (navigates to /social/create with pre-filled content) + bookmark toggle icon
- Toggle/filter at top to show only bookmarked trends
- Loading state with skeleton cards during LLM generation

## Backend

- `social_saved_trends` table: id, topic, platform, trend_title, description, hashtags (JSON array), content_ideas (JSON array), relevance (text), created_at
- `POST /api/social/trends/search` — { topic, platform } → LLM call → array of trend objects
- `POST /api/social/trends/bookmark` — save a trend item
- `GET /api/social/trends/bookmarks` — list saved trends
- `DELETE /api/social/trends/:id` — remove bookmark
- LLM prompt returns structured JSON with 5-8 trending topics

## Create Post Integration

- "Create Post" button navigates to `/social/create?trend=<base64-encoded-json>`
- Create page reads query param and pre-fills caption + hashtags
