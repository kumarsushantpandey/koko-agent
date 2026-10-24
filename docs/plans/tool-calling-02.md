# Tool Calling Feature Plan

**Project:** Akari Watanabe  
**Feature:** Tool Calling / Function Calling  
**Purpose:** Define what the tool-calling feature should achieve, how it should behave, and how it should be exposed through Settings and configuration.

---

# 1. Feature Goal

The goal is to give Akari the ability to use external or internal **tools** when answering the user instead of relying only on the information already available to the language model.

A tool is an action or capability that Akari can request when she needs additional information or needs to perform a supported operation.

The important distinction is:

> Akari should be able to **decide when a tool is useful**, request that tool, receive its result, and then continue the conversation naturally.

Tool calling should become a capability of Akari's conversational system rather than something that changes her personality or normal conversation behavior.

---

# 2. What We Want to Achieve

The feature should allow Akari to move from:

```text
User
  ↓
LLM
  ↓
Answer
```

to:

```text
User
  ↓
LLM
  ↓
Does Akari need a tool?
  │
  ├── No
  │    ↓
  │  Normal answer
  │
  └── Yes
       ↓
    Tool request
       ↓
    Tool executes
       ↓
    Tool result
       ↓
    LLM understands result
       ↓
    Final natural response
```

The user should experience this as one normal conversation.

The internal tool process should not make Akari feel robotic or expose implementation details unless the UI intentionally chooses to show a tool activity indicator.

---

# 3. Core Behavior

When tool calling is enabled, Akari should have access to a defined set of available tools.

For every user message, the AI should be able to determine:

1. Whether it can answer directly.
2. Whether a tool is necessary.
3. Which available tool is appropriate.
4. What information the tool needs.
5. Whether another tool is required after receiving the first result.
6. When it has enough information to answer the user.

The final answer should always be generated after the AI has incorporated the relevant tool results.

---

# 4. Tool Calling Should Be Optional

Tool calling must not be permanently enabled.

There must be a global setting:

```text
Tool Calling
    ON / OFF
```

### When OFF

Akari behaves exactly like a normal LLM conversation.

```text
User
 ↓
LLM
 ↓
Response
```

No tool should be made available to the model.

No tool should be executed.

The existing conversation pipeline should continue to work normally.

### When ON

The selected model may use the available tools if that model/provider supports tool calling.

```text
User
 ↓
LLM
 ↓
Tool if required
 ↓
Tool result
 ↓
LLM
 ↓
Response
```

The AI should not be forced to use a tool for every message.

---

# 5. Model and Provider Compatibility

Tool calling is not universally supported by every AI model or provider.

This must be treated as a first-class capability.

The system should know whether the currently selected:

```text
Provider + Model
```

supports tool calling.

Examples:

```text
Provider A
 ├── Model 1 → Tool Calling Supported
 ├── Model 2 → Tool Calling Supported
 └── Model 3 → Tool Calling Unsupported

Provider B
 ├── Model 1 → Tool Calling Unsupported
 └── Model 2 → Tool Calling Supported
```

The Settings UI must reflect this capability.

---

# 6. Settings Behavior for Unsupported Models

If the currently selected provider/model does **not** support tool calling:

```text
Tool Calling
    Disabled
```

The user should not be able to turn it on for that model.

The UI should clearly communicate why:

```text
Tool Calling
Disabled

The selected model does not support tool calling.
```

The important behavior is:

> Tool calling must be disabled based on the capabilities of the selected provider/model, rather than pretending that every model supports it.

There should be no fake fallback where the system behaves as if the model performed a tool call.

---

# 7. Settings Behavior for Supported Models

If the selected provider/model supports tool calling:

```text
Tool Calling
    ON / OFF
```

The user can choose whether the feature is enabled.

Example:

```text
Model
Mistral — Selected Model

Tool Calling
● Enabled

This model supports tool calling.
```

Switching to another model should immediately update the availability of the Tool Calling setting.

---

# 8. Provider-Level Capability

Tool calling should be treated as a capability of the selected AI provider/model combination.

The system should distinguish between:

```text
Provider supports tool calling
```

and:

```text
Specific model supports tool calling
```

The more specific model capability should determine the final Settings state.

The UI should never enable the feature solely because the provider has some tool-capable models.

---

# 9. Configuration

The application configuration should contain a global tool-calling setting.

Conceptually:

```text
Tool Calling
    Enabled / Disabled
```

The configuration should also contain the limits and availability required for the feature.

The important configuration concepts are:

- Tool calling enabled/disabled.
- Maximum number of tool-call rounds allowed for one conversation turn.
- Tool execution timeout.
- Which tools are currently available.
- Which tools are enabled.
- Provider/model tool-calling capability.

These settings should have sensible defaults.

---

# 10. Settings and Configuration Relationship

The Settings screen should control the runtime preference.

The backend configuration should remain authoritative for whether tools can actually execute.

The relationship should be:

```text
Selected Provider
        +
Selected Model
        ↓
Capability Check
        ↓
Can this model use tools?
        ↓
Tool Calling Setting
        ↓
Runtime Behavior
```

The frontend should not be able to force tool calling on a model that does not support it.

---

# 11. Tool Availability

Tool calling should operate around a defined list of tools.

Akari should never have access to arbitrary system functions.

Every available tool should have a clear purpose.

Examples of possible initial tools:

```text
Current Time
Current Date
System Status
```

These are useful because they allow the tool-calling system to be tested without immediately giving Akari powerful external capabilities.

More tools can be introduced later.

---

# 12. Tool List in Settings

Settings should provide visibility into the tools available to Akari.

Example:

```text
Tool Calling

Enabled

Available Tools

✓ Current Time
✓ Current Date
✓ System Status
```

The first version does not necessarily need per-tool controls.

The important goal is that the user understands:

```text
Tool Calling = enabled
```

and:

```text
These are the capabilities currently available to Akari.
```

Per-tool enable/disable can be added later if required.

---

# 13. Tool Selection Behavior

Akari should not call tools unnecessarily.

For example, if the user asks:

```text
"How are you?"
```

there should be no reason to call a tool.

Akari should simply respond normally.

If the user asks something that requires information unavailable to the model but available through a registered tool, Akari should use the relevant tool.

The principle is:

> Tools should be used when they add necessary information or capability, not simply because they exist.

---

# 14. Tool Call → Result → Response

The fundamental tool interaction should work like this:

### Step 1 — User asks something

```text
User:
"What time is it?"
```

### Step 2 — AI determines that a tool is useful

```text
Tool:
Current Time
```

### Step 3 — Tool returns its result

```text
16:32
```

### Step 4 — AI receives the result

The AI now has the actual tool information.

### Step 5 — AI generates the final response

```text
[neutral] It's 4:32 PM. Why are you checking the time all of a sudden?
```

### Step 6 — Existing Akari pipeline continues

The final response proceeds through:

```text
Emotion
→ Dialogue processing
→ TTS
→ Audio
→ Avatar
```

The tool result itself should never be spoken as if it were Akari's dialogue.

---

# 15. Multiple Tool Calls

The system should support situations where one answer requires more than one tool.

Conceptually:

```text
User
 ↓
LLM
 ↓
Tool A
 ↓
Result A
 ↓
Tool B
 ↓
Result B
 ↓
LLM
 ↓
Final response
```

The model should be able to use multiple available tools when necessary.

There must still be a maximum limit so a single user request cannot create an endless chain of tool calls.

---

# 16. Tool Call Limits

The system should have a configurable maximum number of tool-call rounds.

Example:

```text
Maximum Tool Calls
5
```

The purpose is to prevent:

- Infinite tool loops.
- Excessive API usage.
- Unnecessarily long conversations.
- Excessive model latency.

The limit should be visible/configurable where appropriate.

A bounded range should be used rather than allowing unlimited tool execution.

---

# 17. Tool Errors

A failed tool should not crash Akari's entire conversation.

Possible situations include:

```text
Tool unavailable
Invalid request
Tool execution failed
Tool timed out
Tool is disabled
Maximum tool calls reached
```

The system should handle these as part of the conversation flow.

Akari should either:

1. Recover and continue if possible, or
2. Explain naturally that she could not obtain the requested information.

She should never invent a tool result.

---

# 18. No Fabricated Tool Results

This is a critical behavior requirement.

If Akari requests a tool and the tool does not return a valid result, Akari must not behave as though the tool succeeded.

For example:

```text
Tool requested:
Current Weather

Tool:
Failed
```

Akari should not say:

```text
"It's 28°C outside."
```

unless an actual tool result provided that information.

---

# 19. Tool Results Are Internal Context

Tool results should be treated as information for the language model.

They are not automatically user-facing messages.

The normal user experience should remain:

```text
User
→ Akari thinks
→ Akari responds
```

rather than:

```text
User
→ Tool JSON
→ Tool JSON result
→ Akari
```

The UI may optionally show a subtle status such as:

```text
Akari is checking...
```

but raw tool data should not normally be displayed.

---

# 20. Tool Calling and Akari's Personality

Tool calling must not change Akari's established persona.

Her:

- personality,
- conversational style,
- emotional behavior,
- emotion tags,
- dialogue style,
- relationship dynamics

should remain unchanged.

Tool calling only changes **where information comes from and what capabilities are available**.

It should not turn Akari into a generic assistant.

---

# 21. Tool Calling and Emotion

Tool activity should remain separate from Akari's spoken emotional response.

The flow should be:

```text
Tool request
    ↓
Tool result
    ↓
Final Akari response
    ↓
Emotion detection
    ↓
Avatar expression
```

The tool process itself should not generate avatar emotions.

Only Akari's final conversational response should participate in the existing emotion pipeline.

---

# 22. Tool Calling and TTS

Tool calls and tool results must never accidentally reach TTS.

Only the final natural-language response intended for the user should be spoken.

The intended flow is:

```text
Tool request
    ↓
Tool result
    ↓
Final response
    ↓
TTS
```

Not:

```text
Tool request
    ↓
TTS
```

and not:

```text
Tool result
    ↓
TTS
```

---

# 23. Tool Calling and Streaming

The existing Akari system is designed around streaming responses and low-latency dialogue.

Tool calling must preserve this philosophy.

There are two conceptual stages:

```text
Tool decision stage
```

followed by:

```text
Final response streaming stage
```

Tool-call information should not be treated as normal spoken dialogue.

Once the model has completed the necessary tool interaction and begins producing its final response, the existing streaming/TTS pipeline should continue as normally as possible.

---

# 24. Tool Calling and Conversation History

A tool-enabled conversation needs to retain enough context for the AI to understand:

```text
User request
→ Tool requested
→ Tool result
→ Final response
```

This is important because the model may need to understand why a tool result exists when continuing the conversation.

The conversation history should therefore preserve tool interactions as part of the relevant turn.

The user should still perceive the interaction as one coherent conversation.

---

# 25. Tool Calling and Stop / Interrupt

The existing Stop behavior should also apply to tool-enabled conversations.

If the user interrupts Akari while she is:

```text
thinking
tool calling
waiting for a tool
generating a response
speaking
```

the current turn should stop.

No stale tool result should later cause Akari to resume an old response.

The system should return to a clean idle state.

---

# 26. Tool Activity in the UI

A subtle UI state can be introduced for tool activity.

Possible states:

```text
Thinking...
```

or:

```text
Checking...
```

or:

```text
Using Current Time...
```

This is optional from the core feature perspective.

The important requirement is that tool execution should not make the interface appear frozen.

---

# 27. Settings UX

The Settings screen should contain a dedicated Tool Calling section.

Conceptual layout:

```text
AI / Model Settings
────────────────────────────────

Provider
[ Mistral AI ]

Model
[ Selected Model ]

Tool Calling
[ ON ]

✓ This model supports tool calling

Available Tools
• Current Time
• Current Date
• System Status

Maximum Tool Calls
[ 5 ]
```

If unsupported:

```text
Tool Calling
[ OFF / DISABLED ]

This model does not support tool calling.
```

The control should be visibly disabled rather than allowing the user to enable something that cannot work.

---

# 28. Switching Models

When the user changes models:

```text
Old Model
   ↓
New Model
   ↓
Capability Check
   ↓
Tool Calling UI updates
```

Example:

```text
Model A
Tool Calling → ON
```

User switches to:

```text
Model B
Tool Calling → Unsupported
```

The UI should immediately show:

```text
Tool Calling → Disabled
Reason → Model does not support tool calling
```

The runtime must follow the new capability.

---

# 29. Switching Providers

The same behavior applies when switching providers.

Example:

```text
Provider A + Model A
→ Tool Calling supported
```

Switch to:

```text
Provider B + Model B
→ Tool Calling unsupported
```

The Tool Calling control becomes unavailable.

The system must not carry an enabled tool-calling state into an incompatible provider/model.

---

# 30. Configuration Synchronization

Settings and backend runtime state should remain synchronized.

The intended relationship is:

```text
Settings UI
    ↓
Tool Calling Preference
    ↓
Backend Runtime Configuration
    ↓
Current Provider/Model Capability
    ↓
Actual Tool Availability
```

If the backend determines that the selected model cannot use tools, tool execution must remain unavailable regardless of the UI state.

---

# 31. Default Behavior

The feature should have an explicit default state.

For initial rollout, the recommended product behavior is:

```text
Tool Calling = OFF by default
```

This allows the feature to be tested without changing normal Akari behavior for existing users.

Once the feature is verified, the default can be reconsidered independently.

The important requirement is that the default is explicit and deterministic.

---

# 32. Initial Tool Scope

The first version should focus on simple, safe tools.

The purpose of the first version is to prove the complete tool-calling lifecycle.

Recommended initial capabilities:

```text
Current Time
Current Date
System/Application Status
```

The first version should not attempt to give Akari unrestricted access to the operating system.

---

# 33. Future Tool Categories

The architecture should leave room for future categories such as:

```text
Information
    • Web search
    • Weather
    • News

System
    • Application status
    • Device information

Media
    • Music
    • Playback control

Productivity
    • Calendar
    • Reminders
    • Notes

Files
    • File search
    • Document operations

External Services
    • APIs
    • Messaging
    • Smart-home services
```

These should be introduced individually rather than all at once.

---

# 34. Side-Effecting Tools

Future tools may perform real-world actions.

Examples:

```text
Send a message
Delete a file
Launch an application
Change a setting
Control a device
Create an appointment
```

These are fundamentally different from read-only information tools.

The long-term design should therefore distinguish:

```text
Read-only tool
```

from:

```text
Action / side-effect tool
```

Side-effect tools should eventually have an explicit confirmation mechanism.

The first version does not need to include those actions.

---

# 35. Security Goal

The tool system should be an allowlisted capability system.

Akari should only be able to use tools that the application explicitly makes available.

The goal is:

```text
Defined tools
    ↓
Available capabilities
    ↓
Model chooses from those capabilities
```

Not:

```text
Model
    ↓
Arbitrary code/system access
```

The tool-calling feature should never become a generic command execution mechanism.

---

# 36. Reliability Goals

The feature should remain reliable when:

- Tool calling is disabled.
- Tool calling is enabled.
- The model does not support tool calling.
- A tool fails.
- A tool times out.
- A model requests multiple tools.
- A model repeatedly requests tools.
- The user interrupts the conversation.
- The provider changes.
- The model changes.

The failure of one tool interaction should not destabilize the rest of Akari.

---

# 37. Performance Goals

Tool calling adds additional processing and potentially additional model requests.

The feature should therefore avoid unnecessary tool usage.

The goal is:

```text
Direct answer when possible
```

and:

```text
Tool usage only when useful or necessary
```

Tool results should remain concise enough that they do not unnecessarily consume the model's context.

---

# 38. Implementation Plan

## Phase 1 — Define the Tool System

Goal:

Establish the conceptual tool system and its rules.

Define:

- What constitutes a tool.
- Which tools are available.
- Which tools are safe.
- What information each tool provides.
- Which tools are enabled.
- How tool results are represented conceptually.
- What happens when a tool fails.

Deliverable:

A clear tool capability model that Akari can use consistently.

---

## Phase 2 — Introduce Tool Calling to the Conversation

Goal:

Allow Akari's conversation system to decide between:

```text
Normal response
```

and:

```text
Tool-assisted response
```

Deliverable:

A complete conceptual flow where:

```text
User
→ AI
→ optional tool
→ result
→ AI
→ final response
```

works as one conversation turn.

---

## Phase 3 — Add Provider/Model Capability Detection

Goal:

Know whether the currently selected provider/model supports tool calling.

Deliverable:

The system can distinguish:

```text
Supported
Unsupported
Unknown
```

for the current provider/model.

This capability becomes the source of truth for Settings availability.

---

## Phase 4 — Add Tool Calling Configuration

Goal:

Give the application explicit control over the feature.

Configuration should cover:

- Tool Calling enabled/disabled.
- Maximum tool-call rounds.
- Tool execution timeout.
- Available tools.
- Enabled tools.

Deliverable:

Tool calling can be controlled independently from the rest of the AI configuration.

---

## Phase 5 — Integrate With Settings

Goal:

Make tool calling a visible user-controlled AI capability.

Settings should provide:

```text
Tool Calling
    ON / OFF
```

when supported.

When unsupported:

```text
Tool Calling
    DISABLED
```

with an explanation.

Deliverable:

The user can clearly understand whether tool calling is available and whether it is currently enabled.

---

## Phase 6 — Synchronize Provider, Model, and Tool Settings

Goal:

Make model/provider switching reliable.

When the user changes:

```text
Provider
```

or:

```text
Model
```

the tool-calling availability should update automatically.

Deliverable:

The UI and runtime always reflect the selected model's actual tool-calling capability.

---

## Phase 7 — Integrate With Akari's Existing Response Pipeline

Goal:

Ensure tool calling works without breaking Akari's existing personality and output system.

Final flow:

```text
User
 ↓
LLM
 ↓
Optional Tool Interaction
 ↓
Final LLM Response
 ↓
Emotion
 ↓
Dialogue Processing
 ↓
TTS
 ↓
Avatar
```

Deliverable:

Tool calling becomes an extension of Akari rather than a replacement for the existing conversational pipeline.

---

## Phase 8 — Add Tool Activity Feedback

Goal:

Prevent tool usage from making the interface appear unresponsive.

Optional UI states:

```text
Thinking...
Checking...
Using Current Time...
```

Deliverable:

The user understands that Akari is actively processing a tool-assisted request.

---

## Phase 9 — Handle Failure and Cancellation

Goal:

Make tool calling robust.

Cover:

- Tool failure.
- Unsupported tool.
- Invalid request.
- Timeout.
- Maximum tool-call limit.
- User interruption.
- Provider/model switching.

Deliverable:

Tool failures remain isolated and do not break the conversation system.

---

## Phase 10 — Validate the Complete Feature

The final validation should confirm:

### Tool Calling OFF

```text
User
→ LLM
→ Response
```

### Tool Calling ON + Supported Model

```text
User
→ LLM
→ Tool
→ Result
→ LLM
→ Response
```

### Tool Calling ON + Unsupported Model

```text
Settings
→ Tool Calling unavailable
→ No tool execution
```

### Tool Failure

```text
User
→ LLM
→ Tool
→ Failure
→ Recovery / explanation
```

### Multiple Tools

```text
User
→ LLM
→ Tool A
→ Tool B
→ LLM
→ Response
```

### Interrupt

```text
User
→ LLM
→ Tool
→ Interrupt
→ Clean stop
```

---

# 39. Final User Experience

The desired end state is that Akari remains the same character and conversational experience, but gains additional capabilities.

Without tools:

```text
User:
"How are you?"

Akari:
Normal conversational response.
```

With tools:

```text
User:
"What time is it?"

Akari:
Uses the appropriate time tool,
receives the actual time,
then responds naturally.
```

The user should not need to understand how the tool system works.

They should only need to control whether the capability is enabled.

---

# 40. Final Architecture Goal

The finished feature should conceptually separate five responsibilities:

```text
LLM
    ↓
Decides whether a tool is needed

Tool System
    ↓
Provides controlled capabilities

Provider Capability System
    ↓
Determines whether the selected model can use tools

Settings / Configuration
    ↓
Determines whether the user has enabled tool calling

Akari Response Pipeline
    ↓
Turns the final result into emotion, speech, and avatar behavior
```

The core principle is:

> **Tool calling should expand what Akari can know and do without changing who Akari is.**

The feature should be optional, model-aware, configurable, bounded, and transparent about capability support.
