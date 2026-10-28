import{au as p,r as h,j as e,av as j,aw as g,B as b,ax as C,ay as f,az as u,aA as t,aB as l,aC as n,I,aD as S,aE as D,aF as w,aG as M,aH as A,ag as R}from"./iframe-BjN4PNZi.js";import{P as L}from"./pencil-B8sxykZ5.js";import{C as k}from"./copy-DjBACZ_m.js";import{A as P}from"./archive-vpGSa4fK.js";import{T as v}from"./trash-D4pgkLAF.js";import{C as y}from"./circle-dot-1Hdi-o4t.js";import{C as E}from"./circle-user-ILjuPnhn.js";import{S as N}from"./signal-high-Dzb6_NUQ.js";import{L as O}from"./link-2-EvoKAGAX.js";import{S as T}from"./star-D2CNP4VL.js";import{C as B}from"./circle-dashed-Divtlg0F.js";import"./preload-helper-PPVm8Dsz.js";const $={title:"Overlays/DropdownMenu",component:p,tags:["autodocs"],args:{align:"start",side:"bottom"},argTypes:{align:{control:"inline-radio",options:["start","center","end"]},side:{control:"inline-radio",options:["top","right","bottom","left"]}},render:i=>e.jsxs(j,{children:[e.jsx(g,{asChild:!0,children:e.jsx(b,{children:"Options"})}),e.jsxs(p,{...i,children:[e.jsx(n,{icon:e.jsx(L,{}),shortcut:["E"],children:"Edit"}),e.jsx(n,{icon:e.jsx(k,{}),shortcut:["⌘","D"],children:"Duplicate"}),e.jsx(n,{icon:e.jsx(P,{}),disabled:!0,children:"Archive"}),e.jsx(t,{}),e.jsx(n,{icon:e.jsx(v,{}),tone:"danger",shortcut:["⌘","⌫"],children:"Delete"})]})]}),parameters:{docs:{description:{component:'A menu of actions opened from a button. Items take an `icon`, a `shortcut` and\n`tone="danger"`; there are checkbox items, radio items, labels, separators and submenus.\nArrows move, type-ahead jumps, Enter selects, Escape closes.'}}}},G={docs:{story:{inline:!1,iframeHeight:420}}},d={},c={render:function(){const[o,r]=h.useState({id:!0,priority:!0,assignee:!1}),[m,x]=h.useState("priority");return e.jsxs(j,{children:[e.jsx(g,{asChild:!0,children:e.jsx(b,{children:"Display"})}),e.jsxs(p,{className:"w-56",children:[e.jsx(C,{children:"Ordering"}),e.jsxs(f,{value:m,onValueChange:x,children:[e.jsx(u,{value:"priority",children:"Priority"}),e.jsx(u,{value:"updated",children:"Last updated"}),e.jsx(u,{value:"created",children:"Created"})]}),e.jsx(t,{}),e.jsx(C,{children:"Properties"}),e.jsx(l,{checked:o.id,onCheckedChange:s=>r({...o,id:s}),children:"ID"}),e.jsx(l,{checked:o.priority,onCheckedChange:s=>r({...o,priority:s}),children:"Priority"}),e.jsx(l,{checked:o.assignee,onCheckedChange:s=>r({...o,assignee:s}),children:"Assignee"})]})]})}},F=[{value:"backlog",label:"Backlog",icon:e.jsx(B,{})},{value:"todo",label:"Todo",icon:e.jsx(y,{})},{value:"done",label:"Done",icon:e.jsx(R,{})}];function z({defaultOpen:i=!1}){const[o,r]=h.useState("todo"),[m,x]=h.useState(!1);return e.jsxs("div",{className:"flex h-10 w-[28rem] items-center gap-3 rounded-md border border-line bg-surface-raised px-3 text-sm",children:[e.jsx("span",{className:"text-xs text-fg-subtle",children:"ENG-142"}),e.jsx("span",{className:"flex-1 truncate",children:"Login redirect loops when the session expires"}),e.jsxs(j,{defaultOpen:i,children:[e.jsx(g,{asChild:!0,children:e.jsx(I,{label:"Issue actions",size:"xs",children:e.jsx(S,{})})}),e.jsxs(p,{align:"end",className:"w-60",children:[e.jsxs(D,{children:[e.jsx(w,{icon:e.jsx(y,{}),children:"Status"}),e.jsx(M,{children:e.jsx(f,{value:o,onValueChange:r,children:F.map(s=>e.jsx(u,{value:s.value,children:s.label},s.value))})})]}),e.jsxs(D,{children:[e.jsx(w,{icon:e.jsx(E,{}),children:"Assignee"}),e.jsxs(M,{children:[e.jsx(n,{children:"Tereza Nováková"}),e.jsx(n,{children:"Jakub Dvořák"}),e.jsx(n,{children:"Marie Svobodová"}),e.jsx(t,{}),e.jsx(n,{children:"Unassign"})]})]}),e.jsx(n,{icon:e.jsx(N,{}),shortcut:["P"],children:"Set priority"}),e.jsx(t,{}),e.jsxs(A,{children:[e.jsx(n,{icon:e.jsx(O,{}),shortcut:["⌘","L"],children:"Copy link"}),e.jsx(n,{icon:e.jsx(k,{}),shortcut:["⌘","."],children:"Copy ID"}),e.jsx(l,{checked:m,onCheckedChange:x,children:e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx(T,{className:"size-4 text-fg-muted"}),"Favorite"]})})]}),e.jsx(t,{}),e.jsx(n,{icon:e.jsx(v,{}),tone:"danger",shortcut:["⌘","⌫"],children:"Delete issue"})]})]})]})}const a={parameters:G,render:()=>e.jsx(z,{defaultOpen:!0})},ee=["Playground","CheckboxAndRadio","IssueActions"];d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:"{}",...d.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [columns, setColumns] = useState({
      id: true,
      priority: true,
      assignee: false
    });
    const [ordering, setOrdering] = useState("priority");
    return <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Display</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Ordering</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={ordering} onValueChange={setOrdering}>
            <DropdownMenuRadioItem value="priority">
              Priority
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="updated">
              Last updated
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="created">
              Created
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Properties</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={columns.id} onCheckedChange={id => setColumns({
          ...columns,
          id
        })}>
            ID
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={columns.priority} onCheckedChange={priority => setColumns({
          ...columns,
          priority
        })}>
            Priority
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={columns.assignee} onCheckedChange={assignee => setColumns({
          ...columns,
          assignee
        })}>
            Assignee
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>;
  }
}`,...c.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: openInFrame,
  render: () => <IssueActionsMenu defaultOpen />
}`,...a.parameters?.docs?.source},description:{story:"Linear's “…” menu on an issue row, open by default.",...a.parameters?.docs?.description}}};export{c as CheckboxAndRadio,a as IssueActions,d as Playground,ee as __namedExportsOrder,$ as default};
