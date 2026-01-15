# Cookbooks

## Description

The Cookbooks feature provides a dedicated system for digitizing and organizing family recipe collections. Users can create digital cookbooks with cover images, metadata, and detailed recipe entries. Each cookbook serves as a container for multiple recipes, making it easy to preserve and share family culinary traditions.

The feature includes AI-powered transcription capabilities that can automatically extract recipe text, ingredients, and directions from uploaded images using Google's Gemini API. This dramatically reduces the time needed to digitize handwritten or printed recipes from old cookbooks, recipe cards, or clippings.

Users can:
- Create multiple cookbook collections with cover images and publication details
- Add recipes with images, transcriptions, structured ingredients, and step-by-step directions
- View recipes in both read-only and edit modes
- Automatically extract recipe information from images using AI
- Search and filter recipes within cookbooks
- Track recipe counts per cookbook

## Features

### Cookbook Management
- **Create Cookbooks**: Add new cookbook collections with title, author, publication date, and description
- **Upload Cover Images**: Attach cover photos stored in Firebase Storage (5MB max)
- **Edit Cookbook Details**: Update metadata and replace cover images
- **Delete Cookbooks**: Remove cookbooks with cascading deletion of all associated recipes
- **Search Cookbooks**: Real-time filtering by title, author, or description
- **Recipe Count Display**: See how many recipes are stored in each cookbook

### Recipe Management
- **Create Recipe Entries**: Add recipes with name, image, transcription, ingredients, and directions
- **Recipe Images**: Upload photos of recipe pages or finished dishes
- **Edit Recipes**: Update any recipe details including ingredients and directions
- **Delete Recipes**: Remove individual recipes from cookbooks
- **View Mode**: Read-only display of complete recipe with formatted ingredients and directions
- **Search Recipes**: Filter recipe list within a cookbook

### AI-Powered Transcription
- **Gemini Image Transcription**: Automatically extract text from recipe images
- **One-Click Transcription**: Generate transcription from uploaded recipe image
- **Auto-Fill Ingredients**: Parse transcription to automatically populate ingredient table with amounts and items
- **Auto-Fill Directions**: Extract step-by-step cooking instructions as numbered list
- **Smart Parsing**: JSON-based extraction ensures structured, editable data
- **Manual Override**: Edit AI-generated content or enter manually

### Recipe Structure
- **Rich Text Transcription**: CKEditor for formatted recipe text with headings, lists, and styling
- **Ingredient Table**: Dynamic table with amount and item columns
- **Add/Remove Ingredients**: Flexible row management for ingredient lists
- **Numbered Directions**: Step-by-step cooking instructions with automatic numbering
- **Add/Remove Steps**: Dynamic list management for direction steps
- **Data Validation**: Required fields and empty row filtering on save

### Storage & Organization
- **Firebase Storage Integration**: Recipe images stored with 5MB size limit
- **Folder Structure**: Images organized by cookbook ID and recipe ID
- **Firestore Database**: Recipe metadata and content in real-time database
- **Owner-Based Access**: Security rules enforce user ownership
- **Timestamp Tracking**: Created and updated timestamps on all records

### User Interface
- **Grid Layout**: Visual cookbook cards with cover images
- **Responsive Design**: Mobile-friendly layout adapting to screen size
- **Modal Forms**: Focused add/edit experience for cookbooks and recipes
- **Detail View**: Clean read-only recipe display before editing
- **Empty States**: Helpful messages when no cookbooks or recipes exist
- **Loading States**: Spinners during AI extraction and save operations
- **Error Handling**: User-friendly validation and error messages

### Navigation & Integration
- **Archive Dropdown**: Access cookbooks from Archive dropdown menu
- **Dedicated Route**: `/cookbooks` path for cookbook management
- **Recipe Selector**: Modal interface for browsing recipes within a cookbook
- **Context Preservation**: Maintain cookbook selection when adding/editing recipes
