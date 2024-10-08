import { useRef, useEffect } from "react";
import { FrontendAction } from "../types/frontend-action";
import { useCopilotContext } from "../context/copilot-context";
import { Parameter, randomId } from "@copilotkit/shared";

// We implement useCopilotAction dependency handling so that
// the developer has the option to not provide any dependencies.
// In this case, we assume they want to update the handler on each rerender.
// To avoid getting stuck in an infinite loop, we update the handler directly,
// skipping React state updates.
// This is ok in this case, because the handler is not part of any UI that
// needs to be updated.
// useCallback, useMemo or other memoization techniques are not suitable here,
// because they will cause a infinite rerender loop.
export function useCopilotAction<const T extends Parameter[] | [] = []>(
  action: FrontendAction<T>,
  dependencies?: any[],
): void {
  const { setAction, removeAction, actions, chatComponentsCache } = useCopilotContext();
  const idRef = useRef<string>(randomId());

  // If the developer doesn't provide dependencies, we assume they want to
  // update handler and render function when the action object changes.
  // This ensures that any captured variables in the handler are up to date.
  if (dependencies === undefined) {
    if (actions[idRef.current]) {
      actions[idRef.current].handler = action.handler as any;
      if (typeof action.render === "function") {
        if (chatComponentsCache.current !== null) {
          chatComponentsCache.current.actions[action.name] = action.render;
        }
      }
    }
  }

  useEffect(() => {
    if (action.disabled) {
      return;
    }
    setAction(idRef.current, action as any);
    if (chatComponentsCache.current !== null && action.render !== undefined) {
      chatComponentsCache.current.actions[action.name] = action.render;
    }
    return () => {
      // NOTE: For now, we don't remove the chatComponentsCache entry when the action is removed.
      // This is because we currently don't have access to the messages array in CopilotContext.
      removeAction(idRef.current);
    };
  }, [
    setAction,
    removeAction,
    action.description,
    action.name,
    action.disabled,
    // This should be faster than deep equality checking
    // In addition, all major JS engines guarantee the order of object keys
    JSON.stringify(action.parameters),
    // include render only if it's a string
    typeof action.render === "string" ? action.render : undefined,
    // dependencies set by the developer
    ...(dependencies || []),
  ]);
}

// Usage Example:
// useCopilotAction({
//   name: "myAction",
//   parameters: [
//     { name: "arg1", type: "string", enum: ["option1", "option2", "option3"], required: false },
//     { name: "arg2", type: "number" },
//     {
//       name: "arg3",
//       type: "object",
//       attributes: [
//         { name: "nestedArg1", type: "boolean" },
//         { name: "xyz", required: false },
//       ],
//     },
//     { name: "arg4", type: "number[]" },
//   ],
//   handler: ({ arg1, arg2, arg3, arg4 }) => {
//     const x = arg3.nestedArg1;
//     const z = arg3.xyz;
//     console.log(arg1, arg2, arg3);
//   },
// });

// useCopilotAction({
//   name: "myAction",
//   handler: () => {
//     console.log("No parameters provided.");
//   },
// });
