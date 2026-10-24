# Guidelines for Making Changes to the Project

These guidelines must be followed whenever making changes to the project.

## General Guidelines

### 1. Use Relative File Paths in Markdown

When writing `.md` files and referencing other files, never use absolute or complete file paths. Always use relative paths prefixed with `./` where appropriate.

### 2. Document New Knowledge and Learnings

Whenever you discover new information or learn something new while working on the project, and the approach has been successfully tested, document that knowledge in the `./spec/` folder.

- Create a new `.md` file for each distinct topic or learning.
- Give each file a clear, descriptive title.
- Include the date of documentation.
- Write the content clearly, thoroughly, and in a well-structured manner.
- Ensure that the documented information is accurate, detailed, and up to date.

## Project Information

### 1. Project Overview

**koko** is an AI-powered VRM assistant. She has an energetic, tsundere, tsun-tsun, and yandere personality. She is a gamer, anime fan, and technology enthusiast.

This project contains the source code and implementation of koko and her associated features.

### 2. Client (`./client/`)

The `./client/` directory contains koko's VRM-based 3D avatar, which runs in a web browser.

The client uses **Three.js** and **React Three Fiber** to render and control the 3D avatar.

### 3. Server (`./server/`)

The `./server/` directory contains the backend code that powers koko as an LLM-based agent.

The backend is implemented in **Python** and handles the agent's core functionality.

### 4. Documentation (`./docs/` and `./spec/`)

- **`./docs/`** — Contains the project's context, documentation, and plans for the features and tasks currently being developed.
- **`./spec/`** — Contains technical knowledge, findings, learnings, and successfully tested solutions gathered during project development.

All documentation must be clear, detailed, well-written, properly structured, and kept up to date.

## Technical Guidelines

### 1. Write Clean and Maintainable Code

Always write code that is clean, readable, and easy to understand.

- Use meaningful and consistent file and directory names.
- Maintain a logical and organized folder structure.
- Follow established coding conventions and best practices.
- Avoid unnecessary complexity and duplication.
- Prioritize maintainability, readability, and modularity.

### 2. Research Before Implementation

Before implementing a solution, research the available approaches and identify the best practical option for the task.

- Check reliable online resources, official documentation, and relevant technical references.
- Prefer optimized, maintainable, and well-established solutions over brute-force approaches.
- Consider performance, complexity, reliability, and compatibility with the existing codebase.
- Avoid introducing unnecessary dependencies or architectural complexity.
- Verify that the proposed approach is appropriate for the project's existing architecture and requirements.

The goal is to implement solutions that are efficient, reliable, and maintainable rather than simply choosing the quickest approach.