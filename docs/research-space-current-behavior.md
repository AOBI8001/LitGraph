# Research space: current behavior

LitGraph 1.1.8.

The subtitle is “回答以原文证据为依据，AI 推断会额外标出。” / “Answers are grounded in source evidence; AI inferences are explicitly marked.”

Choose a single paper, selected papers or the project-wide scope. Tabs keep conversations separate and can be dragged horizontally to reorder without replacing their conversations or drafts. Tab dragging does not activate the file-drop overlay. Windows can be moved and resized; the composer accepts supported local attachments.

Enter sends; Shift+Enter adds a line. During a request, the control becomes a stop button and displays elapsed time. Stopping cancels the request. Continuing resubmits the previous question; it does not resume the provider's hidden reasoning. New input switches back to sending a new question.

Quick / expert indicate a speed-versus-depth preference, not a guaranteed latency or a provider-independent model switch. Supported providers may also receive reasoning controls. Both modes require the same evidence discipline.

The backend may return only reasoning, an error, or malformed JSON even when the connection test succeeds. Such a response is not a usable final answer. The UI must explain the failure rather than exposing internal reasoning as the answer.

Answers use retrieved original excerpts where available. Missing full text is disclosed per paper. By default, no extra citation list is appended; explicitly requested sources must refer to supplied evidence. AI inference is marked. Three short follow-up questions arise from the actual answer and can be clicked to ask the next question.

See [AI contract](research-space-rag-agent-spec.md), [storage and limitations](architecture.md) and [external Agent guide](LITGRAPH_AGENT_GUIDE.md).
