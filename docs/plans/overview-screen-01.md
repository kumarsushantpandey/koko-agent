# Sidebar & Screen Navigation Implementation Plan

## Objective

Redesign the AI Waifu client shell to use a persistent left sidebar and URL-driven screens, matching the structure and visual character of the provided reference image.

The implementation must preserve the existing chat functionality and the existing server-driven audio functionality while introducing a shared navigation shell around them.

Create all work in a **new Git branch**. Do not modify the existing implementation directly on the current branch.

---

## Reference

Use the provided reference image as the visual reference for the overall application shell:

- Dark desktop application layout.
- Narrow fixed sidebar on the far left.
- Main content area occupying the remaining viewport.
- Small application/logo area near the top.
- Navigation icons arranged vertically.
- Theme control at the bottom of the sidebar.
- Character-oriented overview screen with a large central character/model area.
- Compact information/control panel on the left side of the main content.
- Character selector near the bottom of the overview screen.

The reference is a visual direction, not a requirement to copy unrelated product-specific content.

---

# 1. Git / Branch Requirement

Before making implementation changes:

- Create a new Git branch specifically for this work.
- Keep all changes for this feature isolated to that branch.
- Do not mix unrelated refactors, feature work, or cleanup into the branch.
- Existing functionality must remain available unless explicitly changed by this specification.

---

# 2. Application Navigation

Introduce four primary screens:

1. Characters / Overview
2. Chat
3. OpenSpace / Stream
4. Gallery

The navigation must be represented by the persistent left sidebar.

### Navigation order

The sidebar items must appear in this order:

| Position | Screen | URL |
|---|---|---|
| 1 | Characters / Overview | `/?screen=characters&character=akari` |
| 2 | Chat | `/?screen=chat&character=akari` |
| 3 | OpenSpace / Stream | `/?screen=stream&character=akari` |
| 4 | Gallery | `/?screen=galary&character=akari` |

Use the URL spelling `galary` exactly as specified above.

The sidebar must visually indicate which screen is currently active.

Navigation must update the URL so that each screen can be directly opened using its URL.

Opening one of the URLs directly must render the corresponding screen.

---

# 3. Character Parameter

The current character is represented by the `character` query parameter.

For the current implementation:

- The active character is `akari`.
- All four screens must use `character=akari`.
- Character switching is not required in this implementation.
- The URL structure must nevertheless keep the character parameter so additional characters can be introduced later without redesigning the navigation structure.

Expected examples:

```text
/?screen=characters&character=akari
/?screen=chat&character=akari
/?screen=stream&character=akari
/?screen=galary&character=akari
```

The active character should remain consistent while navigating between screens.

---

# 4. Persistent Sidebar

Create one shared application sidebar that remains visually consistent across all four screens.

The sidebar should follow the reference image:

- Narrow vertical layout.
- Full-height application shell.
- Navigation icons stacked vertically.
- Active screen visually highlighted.
- Theme control positioned at the bottom.
- Minimal, dark, desktop-oriented appearance.
- Sidebar should not be recreated independently inside each screen.

### Sidebar navigation

The four navigation entries correspond to:

#### 1. Characters

Icon represents the character/model overview.

Navigates to:

```text
/?screen=characters&character=akari
```

#### 2. Chat

Icon represents the existing web-chat interface.

Navigates to:

```text
/?screen=chat&character=akari
```

#### 3. OpenSpace

Icon represents the server-driven audio interaction mode.

Navigates to:

```text
/?screen=stream&character=akari
```

This screen is the second chat mode currently implemented in the client.

#### 4. Gallery

Icon represents the character gallery/model view.

Navigates to:

```text
/?screen=galary&character=akari
```

The gallery does not need a complete gallery system yet.

---

# 5. Theme Control

The bottom item of the sidebar must be the theme control.

The existing theme icon/control should be replaced with the new sidebar theme control.

Supported theme values:

```text
light
dark
```

Theme selection must persist between page reloads using `localStorage`.

The stored theme must be restored when the application starts.

Required behavior:

- Selecting light mode changes the application to light mode.
- Selecting dark mode changes the application to dark mode.
- Reloading the page preserves the selected theme.
- The sidebar theme control remains available on every screen.
- Theme state must not depend on the currently selected screen or character.

Do not introduce additional theme modes.

---

# 6. Characters / Overview Screen

URL:

```text
/?screen=characters&character=akari
```

This is the primary screen and should visually follow the provided reference.

The screen should contain:

### Application header

A compact top area containing:

- Application/product identity.
- Current context indicating the character section.
- Connection/status indication where appropriate.

The exact text should follow the existing application's terminology where applicable.

### Character information panel

A compact panel positioned toward the left side of the main content area.

It should represent the selected character and provide the overview controls/information currently appropriate to the character.

For the current character:

```text
Akari
```

The panel should include the existing character information that is already available in the client.

Do not invent new character functionality.

### Main character/model area

The selected character/model should be the primary visual element of the page.

For the current implementation:

```text
Akari
```

The existing model/character rendering must remain functional.

The model should occupy the central/main visual area rather than being constrained inside the sidebar or information panel.

### Character selector

The bottom portion of the overview screen should support the existing character-selection presentation shown in the reference.

For this implementation:

- Akari must be available.
- Existing character entries should be preserved if they already exist.
- Additional character management is not part of this feature.

If the current client only has Akari available, do not create fake characters simply to populate the UI.

### Overview-specific behavior

The first screen must function as the character landing page.

It must not contain the existing chat UI as its primary content.

---

# 7. Chat Screen

URL:

```text
/?screen=chat&character=akari
```

This screen must contain the **current web-chat feature exactly as the existing application provides it**, wrapped inside the new application shell.

Requirements:

- Existing chat behavior must continue to work.
- Existing chat interactions must not be removed.
- The active sidebar item must be Chat.
- The current character must remain Akari.
- The URL must represent the chat screen.
- Navigating away from Chat and returning must still open the chat screen correctly.

Do not redesign the underlying chat functionality as part of this task unless required to fit the new application shell.

---

# 8. OpenSpace / Stream Screen

URL:

```text
/?screen=stream&character=akari
```

This screen represents the **second chat interaction mode currently present in the application: server-driven audio mode**.

Requirements:

- Preserve the existing server-driven audio functionality.
- Place it inside the new application shell.
- The active sidebar item must be OpenSpace.
- The URL must use `screen=stream`.
- The current character must remain Akari.
- Existing server-driven audio behavior must not be replaced with a mock implementation.
- Existing controls and interaction flow should remain functional.

The screen can receive visual/layout changes necessary to integrate with the new shell, but its existing functionality must remain intact.

---

# 9. Gallery Screen

URL:

```text
/?screen=galary&character=akari
```

This is intentionally a minimal screen for the current phase.

The page should currently show the selected character/model.

For now:

- Display Akari.
- Use the same existing model/character representation where applicable.
- Keep the screen visually consistent with the application shell.
- The page should be structured so that more gallery functionality can be added later.

Do not implement:

- Gallery search.
- Filters.
- Sorting.
- Uploads.
- Multiple gallery collections.
- Advanced asset management.

Those are future work.

---

# 10. Screen Resolution / Unknown Screen Handling

The application must have a defined behavior when the `screen` query parameter is:

- Missing.
- Unknown.
- Invalid.

The application should resolve to the Characters / Overview screen as the default application screen.

The default character should be:

```text
akari
```

When the application is opened without a screen/character query, the resulting application state should correspond to the Characters / Overview screen for Akari.

The navigation state and visible screen must always agree with the URL.

---

# 11. Layout Structure

The application should use one shared shell:

```text
Application
├── Sidebar
│   ├── Characters
│   ├── Chat
│   ├── OpenSpace
│   ├── Gallery
│   └── Theme
│
└── Main Content
    ├── Characters / Overview
    ├── Chat
    ├── OpenSpace / Stream
    └── Gallery
```

The sidebar is persistent.

Only the main screen content changes when navigation changes.

Do not duplicate the sidebar implementation across individual screens.

---

# 12. Visual Direction

The visual language should follow the supplied reference:

- Dark-first application aesthetic.
- Muted neutral background.
- High contrast for important controls.
- Thin borders and subtle panels.
- Rounded UI surfaces where appropriate.
- Compact typography.
- Minimal visual noise.
- Small monochrome navigation icons.
- Clear active navigation state.
- Large visual focus on the character/model.
- Dense but clean desktop application layout.

The design should feel like an AI character desktop client rather than a generic marketing website.

Do not copy unrelated branding, text, or assets from the reference image.

---

# 13. Responsive Behavior

The primary target is desktop.

The sidebar and main application layout must remain usable at common desktop viewport sizes.

Do not build a separate mobile navigation system as part of this task.

The implementation must not cause horizontal overflow at normal desktop resolutions.

---

# 14. Existing Functionality Preservation

This feature is a shell/navigation change, not a replacement of the existing AI functionality.

Before considering the work complete, verify that:

- Existing web chat still works.
- Existing server-driven audio mode still works.
- Existing character/model rendering still works.
- Existing AI interactions remain available.
- Existing assets continue to load.
- Theme switching does not break existing screens.
- Navigation does not break existing functionality.

Avoid unrelated refactoring.

---

# 15. URL / State Requirements

The following URL-to-screen mapping is mandatory:

| URL | Screen |
|---|---|
| `/?screen=characters&character=akari` | Characters / Overview |
| `/?screen=chat&character=akari` | Existing Web Chat |
| `/?screen=stream&character=akari` | Existing Server-Driven Audio / OpenSpace |
| `/?screen=galary&character=akari` | Gallery / Character Model |

The URL is the source of truth for the currently selected screen.

The active sidebar state must reflect the URL.

The character shown by the screen must correspond to the `character` query parameter.

---

# 16. Acceptance Criteria

The implementation is complete only when all of the following are true:

### Git

- [ ] Work exists on a new dedicated Git branch.
- [ ] No unrelated feature changes are included.

### Sidebar

- [ ] Persistent sidebar exists.
- [ ] Four navigation items exist in the required order.
- [ ] Active screen is visually indicated.
- [ ] Theme control exists at the bottom.
- [ ] Sidebar is shared across screens.

### Characters

- [ ] Characters screen exists.
- [ ] Characters screen is the default screen.
- [ ] Akari is displayed.
- [ ] Character information area exists.
- [ ] Character/model area remains functional.
- [ ] Character selector presentation is supported where existing character data exists.

### Chat

- [ ] Chat URL works.
- [ ] Existing web-chat feature works.
- [ ] Chat is shown inside the new shell.

### OpenSpace

- [ ] Stream URL works.
- [ ] Existing server-driven audio mode works.
- [ ] OpenSpace is shown inside the new shell.

### Gallery

- [ ] Gallery URL works.
- [ ] Akari/model is displayed.
- [ ] Gallery remains intentionally minimal.

### Theme

- [ ] Light theme works.
- [ ] Dark theme works.
- [ ] Theme selection is persisted in `localStorage`.
- [ ] Theme persists after reload.
- [ ] Theme is independent of the selected screen.

### URL State

- [ ] Direct navigation to every required URL works.
- [ ] Sidebar state matches the URL.
- [ ] Screen state matches the URL.
- [ ] Default screen resolves to Characters.
- [ ] Default character resolves to Akari.
- [ ] Unknown screen values do not leave the application in an undefined state.

### Regression

- [ ] Existing AI chat functionality still works.
- [ ] Existing server-driven audio functionality still works.
- [ ] Existing model rendering still works.
- [ ] No existing feature is replaced by a placeholder.

---

# 17. Out of Scope

Do not implement the following in this branch:

- Multiple-character support beyond preserving the URL structure.
- Character creation.
- Character editing workflows beyond existing functionality required by the overview.
- Full gallery management.
- Gallery uploads.
- Gallery filtering/search.
- New AI models.
- New chat providers.
- New server-driven audio functionality.
- New AI personality functionality.
- Authentication changes.
- Backend architecture changes unrelated to this shell.
- Database changes unrelated to this shell.
- Mobile-specific navigation.
- Unrelated visual redesigns elsewhere in the application.

---

# 18. Final Implementation Prompt

Implement the AI Waifu client navigation and application shell specified in this document.

Create the work in a new Git branch.

Add a persistent left sidebar matching the provided visual reference and containing, in order:

1. Characters
2. Chat
3. OpenSpace
4. Gallery

Use these exact URL structures:

```text
/?screen=characters&character=akari
/?screen=chat&character=akari
/?screen=stream&character=akari
/?screen=galary&character=akari
```

Make the URL determine the active screen and make the sidebar reflect the active screen.

Use `akari` as the current character while preserving the `character` query parameter for future character support.

Make Characters / Overview the default screen and make it visually follow the supplied reference: character-focused main area, character information panel, application header, and character selector presentation.

Move the existing web-chat feature into the Chat screen without changing its functionality.

Move/preserve the existing server-driven audio interaction mode in the OpenSpace / Stream screen without replacing it with a mock.

Add the Gallery screen as a minimal character/model display for Akari, leaving advanced gallery functionality for future work.

Replace the existing theme control with a theme control at the bottom of the sidebar. Support only `light` and `dark`, and persist the selected theme using `localStorage`.

Keep the sidebar shared and persistent across all screens.

Preserve all existing AI, model, chat, and server-driven audio functionality.

Do not introduce unrelated refactors or features.

Use the provided reference image as the visual direction for the application shell, spacing, sidebar treatment, panel styling, active navigation state, and overall desktop application composition.




# Design Style
## Visual Design Direction — Sidebar & Application Shell

Use the provided reference image as the direct visual reference for the application's sidebar and overall desktop application shell.

Do not reinterpret the sidebar into a generic dashboard/sidebar design. Match the same visual language, proportions, spacing, density, and understated appearance of the reference.

### Overall Style

The UI should feel like a polished desktop AI character application:

- Dark-first.
- Minimal.
- Compact.
- Slightly industrial / utility-oriented.
- Low visual noise.
- Muted neutral colors.
- Thin borders.
- Subtle contrast between surfaces.
- Small, restrained typography.
- Rounded corners, but not excessively rounded.
- No gradients.
- No glassmorphism.
- No excessive shadows.
- No large colorful UI elements.
- No oversized navigation labels.
- No generic SaaS-dashboard appearance.

The character/model should remain the visual focus of the application rather than the navigation itself.

---

## Color System

Base the dark theme closely on the reference image.

Use these colors as the primary design tokens:

```text
Background:
#1A1C1C

Sidebar:
#121212

Surface:
#232623

Surface Secondary:
#222522

Surface Elevated:
#1E201F

Border:
#3B3B3B

Border Subtle:
#292929

Primary Text:
#F2F0E7

Secondary Text:
#A6A6A0

Muted Text:
#777874

Hover:
#282A28

Active Navigation:
#2B302B

Accent:
#E5E1DC

Success / Connected:
#8FAF91