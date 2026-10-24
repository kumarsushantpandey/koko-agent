# Image Support Implementation Plan

## Objective
The goal is to support image also as input this AI, allow user to send image with the message and AI should be able to see and talk about the image. AI will respond in text.  

---

### Detailed breakdown
in the chat page user can send images also with input and the ai model can understand the image and respond accordingly, in chatbox left side well be adding camera icon to send image, and will show short preview as oters shows before sending. and this feature wil be only available to the providers/models which support images.

or else we can use some other model to get image features and use it as input to the model, and respond accordingly.


## You dont have to directly code it, first we will brainstrom and decide the architecture and best path to go with and then we'll be coding it, first use internet and research the best aproach and how others are doing this and then only implement this with best practices. you must follow GUIDLINES.md .  


### Task List

1. [x] Create a new branch for the image support implementation (`feat/image-support`).
2. [x] Implement the image input functionality in the chat interface (`./client/src/components/ChatInput.tsx`, camera button, drag-and-drop, clipboard paste, client canvas compression in `./client/src/utils/imageUtils.ts`).
3. [x] Implement the image analysis functionality in the AI model (Native multimodal for `pixtral-12b-2409` & `openrouter/free` in `./server/src/llm/mistral_model.py` and `./server/src/llm/openrouter_model.py`, and hybrid background vision analysis in `./server/src/llm/vision.py`).
4. [x] Implement the image preview display functionality in the chat interface (glassmorphic preview chip with thumbnail, details, and dismiss button before sending, keeping the 3D scene clean).
5. [x] Test the image support functionality across native vision and hybrid fallback modes.

### Testing

1. [x] Create/use test image (`./client/public/akari_avatar.jpg`).
2. [x] Send image to the AI model via `stream_chat` / WebSocket pipeline.
3. [x] Verify that the AI model can see and talk about the image (accurately identified cat ears, purple lighting, choker, and responded in Tsundere gyaru persona with emotion tags).
4. [x] Verify that the image preview is displayed in the chat interface with dismiss option.
5. [x] Verify that VRM emotion blendshapes and TTS speech audio segments are triggered synchronously.

---

