import { SuggestionOptions } from "@tiptap/suggestion";
import MentionList, { MentionListRef } from "./MentionList";
import tippy, { Instance } from "tippy.js";
import 'tippy.js/themes/light.css';
import { ReactRenderer } from "@tiptap/react";

let allMentionUsers: string[] = [];

export const setMentionUsers = (list: string[]) => {
  allMentionUsers = list;
};

const suggestion: Partial<SuggestionOptions> = {
  char: "@",
  items: ({ query }) => {
    return allMentionUsers
      .filter((user) => user.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5);
  },
  render: () => {
    let component: ReactRenderer<MentionListRef>;
    let popup: Instance | null = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        popup = tippy(document.body, {
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          theme: "mention",
          arrow: false, 
          
        });
      },
      onUpdate(props) {
        component.updateProps(props);
        popup?.setProps({
          getReferenceClientRect: () =>
            props.clientRect?.() ?? new DOMRect(0, 0, 0, 0),
        });
      },
      onKeyDown(props) {
        return component.ref?.onKeyDown(props) ?? false;
      },
      onExit() {
        popup?.destroy();
        component?.destroy();
      },
    };
  },
};

export default suggestion;
