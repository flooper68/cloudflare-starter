import{a6 as j,cs as c,j as e,ct as i,cu as h,r as C,cv as O,cw as x,cx as s,cy as w,B as G,S as R,cz as D,cA as S,P as M,ag as T,cB as A}from"./iframe-BjN4PNZi.js";import{C as y}from"./circle-dot-1Hdi-o4t.js";import{C as b}from"./circle-dashed-Divtlg0F.js";import{C as P}from"./circle-user-ILjuPnhn.js";import{S as f}from"./signal-high-Dzb6_NUQ.js";import{L as _}from"./link-2-EvoKAGAX.js";import{C as K}from"./copy-DjBACZ_m.js";import{F as $}from"./folder-kanban-YNL2kew5.js";import{U as z}from"./user-plus-DQ5D-oOB.js";import{I as B}from"./inbox-CXA9en-m.js";import{A as F}from"./arrow-right-dmFOCM8o.js";import"./preload-helper-PPVm8Dsz.js";const k={name:"moon",size:24,node:[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]]};k.node;const g=j(k);const I={name:"signal-low",size:24,node:[["path",{d:"M2 20h.01",key:"4haj6o"}],["path",{d:"M7 20v-4",key:"j294jx"}]]};I.node;const U=j(I);const v={name:"signal-medium",size:24,node:[["path",{d:"M2 20h.01",key:"4haj6o"}],["path",{d:"M7 20v-4",key:"j294jx"}],["path",{d:"M12 20v-8",key:"i3yub9"}]]};v.node;const W=j(v);const L={name:"timer",size:24,node:[["line",{x1:"10",x2:"14",y1:"2",y2:"2",key:"14vaq8"}],["line",{x1:"12",x2:"15",y1:"14",y2:"11",key:"17fdiu"}],["circle",{cx:"12",cy:"14",r:"8",key:"1e1u0o"}]]};L.node;const H=j(L),ce={title:"Overlays/CommandPalette",component:c,tags:["autodocs"],args:{placeholder:"Type a command or search…",label:"Command palette",children:null},parameters:{docs:{story:{inline:!1,iframeHeight:620},description:{component:'The ⌘K command palette. A search field over grouped commands with icons and shortcut\nhints. Commands can open nested pages (“Change status…”); Backspace on an empty field\nor Escape goes back. `useCommandPalette()` binds ⌘K / Ctrl+K; `useCommandPages()` gives\nitems `push`, `pop` and `close`.\n\n```tsx\nconst { open, setOpen } = useCommandPalette();\n<CommandPalette open={open} onOpenChange={setOpen}>\n  <CommandPage>\n    <CommandEmpty />\n    <CommandGroup heading="Issues">\n      <CommandItem icon={<Plus />} shortcut={["C"]} onSelect={...}>Create issue</CommandItem>\n    </CommandGroup>\n  </CommandPage>\n</CommandPalette>\n```'}}}},q=[{id:"backlog",label:"Backlog",icon:e.jsx(b,{}),key:"1"},{id:"todo",label:"Todo",icon:e.jsx(y,{}),key:"2"},{id:"in-progress",label:"In Progress",icon:e.jsx(H,{}),key:"3"},{id:"done",label:"Done",icon:e.jsx(T,{}),key:"4"},{id:"canceled",label:"Canceled",icon:e.jsx(A,{}),key:"5"}],J=[{id:"urgent",label:"Urgent",icon:e.jsx(f,{})},{id:"high",label:"High",icon:e.jsx(f,{})},{id:"medium",label:"Medium",icon:e.jsx(W,{})},{id:"low",label:"Low",icon:e.jsx(U,{})}],X=["Tereza Nováková","Jakub Dvořák","Marie Svobodová","Ondřej Černý"];function N({onRun:r}){const{push:a,close:o}=D(),t=n=>{r(n),o()};return e.jsxs(e.Fragment,{children:[e.jsxs(i,{children:[e.jsx(h,{}),e.jsxs(x,{heading:"ENG-142",children:[e.jsx(s,{icon:e.jsx(y,{}),shortcut:["S"],onSelect:()=>a("status",{title:"Change status",placeholder:"Change status to…"}),children:"Change status…"}),e.jsx(s,{icon:e.jsx(P,{}),shortcut:["A"],onSelect:()=>a("assignee",{title:"Assign",placeholder:"Assign to…"}),children:"Assign to…"}),e.jsx(s,{icon:e.jsx(f,{}),shortcut:["P"],onSelect:()=>a("priority",{title:"Priority",placeholder:"Set priority to…"}),children:"Set priority…"}),e.jsx(s,{icon:e.jsx(_,{}),shortcut:["⌘","L"],onSelect:()=>t("Copied link to ENG-142"),children:"Copy issue URL"}),e.jsx(s,{icon:e.jsx(K,{}),shortcut:["⌘","."],onSelect:()=>t("Copied ENG-142"),children:"Copy issue ID"})]}),e.jsx(S,{}),e.jsxs(x,{heading:"Create",children:[e.jsx(s,{icon:e.jsx(M,{}),shortcut:["C"],onSelect:()=>t("New issue"),children:"Create new issue"}),e.jsx(s,{icon:e.jsx($,{}),onSelect:()=>t("New project"),children:"Create new project"}),e.jsx(s,{icon:e.jsx(z,{}),onSelect:()=>t("Invite people"),children:"Invite people"})]}),e.jsx(S,{}),e.jsxs(x,{heading:"Navigation",children:[e.jsx(s,{icon:e.jsx(B,{}),shortcut:["G","I"],onSelect:()=>t("Go to Inbox"),children:"Go to Inbox"}),e.jsx(s,{icon:e.jsx(F,{}),hint:"Project",keywords:["mobile","ios","android"],onSelect:()=>t("Opened Mobile app v2"),children:"Mobile app v2"}),e.jsx(s,{icon:e.jsx(g,{}),shortcut:["⌘","⇧","L"],onSelect:()=>t("Theme switched"),children:"Switch theme"})]})]}),e.jsxs(i,{id:"status",children:[e.jsx(h,{children:"No status matches"}),q.map(n=>e.jsx(s,{icon:n.icon,shortcut:[n.key],hint:n.id==="in-progress"?"Current":void 0,onSelect:()=>t(`Status → ${n.label}`),children:n.label},n.id))]}),e.jsxs(i,{id:"assignee",children:[e.jsx(h,{children:"Nobody with that name"}),e.jsx(s,{icon:e.jsx(P,{}),onSelect:()=>t("Unassigned"),children:"No assignee"}),X.map(n=>e.jsx(s,{icon:e.jsx("span",{className:"flex size-4 items-center justify-center rounded-full bg-accent-subtle text-[9px] font-semibold text-accent",children:n.split(" ").map(E=>E[0]).join("")}),onSelect:()=>t(`Assigned to ${n}`),children:n},n))]}),e.jsx(i,{id:"priority",children:J.map(n=>e.jsx(s,{icon:n.icon,onSelect:()=>t(`Priority → ${n.label}`),children:n.label},n.id))})]})}const d={args:{defaultOpen:!0,context:"ENG-142"},render:function(a){const[o,t]=C.useState(null);return e.jsxs("div",{className:"flex flex-col items-center gap-2 text-sm text-fg-muted",children:[e.jsx("span",{children:o?`Ran: ${o}`:"Run a command"}),e.jsx(c,{...a,children:e.jsx(N,{onRun:t})})]})}},m={render:function(){const{open:a,setOpen:o}=w(),[t,n]=C.useState(null);return e.jsxs("div",{className:"flex flex-col items-center gap-3 text-sm text-fg-muted",children:[e.jsx(G,{onClick:()=>o(!0),trailing:e.jsx(R,{keys:["⌘","K"]}),children:"Search or run a command"}),t?e.jsxs("span",{children:["Ran: ",t]}):null,e.jsx(c,{open:a,onOpenChange:o,children:e.jsx(N,{onRun:n})})]})}},l={args:{defaultOpen:!0},render:r=>e.jsx(c,{...r,children:e.jsx(i,{children:e.jsx(h,{children:"No results. Try “issue”, “project” or a person’s name."})})})},u={args:{defaultOpen:!0,placeholder:"Search issues…"},render:function(a){const[o,t]=C.useState(!0);return C.useEffect(()=>{const n=setTimeout(()=>t(!1),1500);return()=>clearTimeout(n)},[]),e.jsx(c,{...a,children:e.jsxs(i,{children:[o?e.jsx(O,{}):null,o?null:e.jsxs(e.Fragment,{children:[e.jsx(h,{}),e.jsxs(x,{heading:"Issues",children:[e.jsx(s,{icon:e.jsx(y,{}),hint:"ENG-142",children:"Login redirect loops when the session expires"}),e.jsx(s,{icon:e.jsx(b,{}),hint:"ENG-139",children:"Add rate limiting to the public API"})]})]})]})})}},p={args:{defaultOpen:!0,footer:!1},render:r=>e.jsx(c,{...r,children:e.jsx(i,{children:e.jsxs(x,{heading:"Theme",children:[e.jsx(s,{icon:e.jsx(g,{}),children:"Dark"}),e.jsx(s,{icon:e.jsx(g,{}),children:"Light"}),e.jsx(s,{icon:e.jsx(g,{}),children:"System"})]})})})},de=["Playground","WithShortcut","Empty","Loading","WithoutFooter"];d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    defaultOpen: true,
    context: "ENG-142"
  },
  render: function Render(args) {
    const [last, setLast] = useState<string | null>(null);
    return <div className="flex flex-col items-center gap-2 text-sm text-fg-muted">
        <span>{last ? \`Ran: \${last}\` : "Run a command"}</span>
        <CommandPalette {...args}>
          <IssueCommands onRun={setLast} />
        </CommandPalette>
      </div>;
  }
}`,...d.parameters?.docs?.source},description:{story:"Open by default: the issue palette with nested pages. Try “Change status…”.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const {
      open,
      setOpen
    } = useCommandPalette();
    const [last, setLast] = useState<string | null>(null);
    return <div className="flex flex-col items-center gap-3 text-sm text-fg-muted">
        <Button onClick={() => setOpen(true)} trailing={<Shortcut keys={["⌘", "K"]} />}>
          Search or run a command
        </Button>
        {last ? <span>Ran: {last}</span> : null}
        <CommandPalette open={open} onOpenChange={setOpen}>
          <IssueCommands onRun={setLast} />
        </CommandPalette>
      </div>;
  }
}`,...m.parameters?.docs?.source},description:{story:"Press ⌘K (or Ctrl+K) anywhere in the canvas.",...m.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    defaultOpen: true
  },
  render: args => <CommandPalette {...args}>
      <CommandPage>
        <CommandEmpty>
          No results. Try “issue”, “project” or a person’s name.
        </CommandEmpty>
      </CommandPage>
    </CommandPalette>
}`,...l.parameters?.docs?.source},description:{story:"Nothing matches the search.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    defaultOpen: true,
    placeholder: "Search issues…"
  },
  render: function Render(args) {
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      const timer = setTimeout(() => setLoading(false), 1500);
      return () => clearTimeout(timer);
    }, []);
    return <CommandPalette {...args}>
        <CommandPage>
          {loading ? <CommandLoading /> : null}
          {loading ? null : <>
              <CommandEmpty />
              <CommandGroup heading="Issues">
                <CommandItem icon={<CircleDot />} hint="ENG-142">
                  Login redirect loops when the session expires
                </CommandItem>
                <CommandItem icon={<CircleDashed />} hint="ENG-139">
                  Add rate limiting to the public API
                </CommandItem>
              </CommandGroup>
            </>}
        </CommandPage>
      </CommandPalette>;
  }
}`,...u.parameters?.docs?.source},description:{story:"Async results: render CommandLoading while the request runs.",...u.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    defaultOpen: true,
    footer: false
  },
  render: args => <CommandPalette {...args}>
      <CommandPage>
        <CommandGroup heading="Theme">
          <CommandItem icon={<Moon />}>Dark</CommandItem>
          <CommandItem icon={<Moon />}>Light</CommandItem>
          <CommandItem icon={<Moon />}>System</CommandItem>
        </CommandGroup>
      </CommandPage>
    </CommandPalette>
}`,...p.parameters?.docs?.source},description:{story:"Custom footer, or `footer={false}` to hide it.",...p.parameters?.docs?.description}}};export{l as Empty,u as Loading,d as Playground,m as WithShortcut,p as WithoutFooter,de as __namedExportsOrder,ce as default};
