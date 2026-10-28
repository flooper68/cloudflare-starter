import{a7 as r,r as c,j as e,a8 as d,a9 as l,aa as g,ab as j,ac as M,ad as f,ae as S,af as a,ag as k,ah as t,ai as N,aj as x}from"./iframe-BjN4PNZi.js";import{C as u}from"./circle-dot-1Hdi-o4t.js";import{C as v}from"./circle-dashed-Divtlg0F.js";import{L as I}from"./link-2-EvoKAGAX.js";import{T as m}from"./trash-D4pgkLAF.js";import{P as w}from"./pencil-B8sxykZ5.js";import{C as R}from"./copy-DjBACZ_m.js";import{A as D}from"./archive-vpGSa4fK.js";import"./preload-helper-PPVm8Dsz.js";const V={title:"Overlays/ContextMenu",component:r,tags:["autodocs"],render:i=>e.jsxs(d,{children:[e.jsx(l,{className:"flex h-32 w-80 items-center justify-center rounded-lg border border-dashed border-line-strong text-sm text-fg-muted",children:"Right-click here"}),e.jsxs(r,{...i,children:[e.jsx(t,{icon:e.jsx(w,{}),shortcut:["E"],children:"Edit"}),e.jsx(t,{icon:e.jsx(R,{}),shortcut:["⌘","D"],children:"Duplicate"}),e.jsx(t,{icon:e.jsx(D,{}),disabled:!0,children:"Archive"}),e.jsx(x,{}),e.jsx(t,{icon:e.jsx(m,{}),tone:"danger",children:"Delete"})]})]}),parameters:{docs:{description:{component:'A right-click menu (long-press on touch). Rows look exactly like DropdownMenu rows:\n`icon`, `shortcut`, `tone="danger"`, checkbox and radio items, submenus. Always offer the\nsame actions elsewhere too (a "…" button), since right-click is not discoverable.'}}}},o={},y=[{id:"ENG-142",title:"Login redirect loops when the session expires"},{id:"ENG-139",title:"Add rate limiting to the public API"},{id:"ENG-131",title:"Dark mode: chart tooltips are unreadable"}],n={render:function(){const[h,p]=c.useState("todo"),[C,b]=c.useState(!0);return e.jsx("div",{className:"w-[30rem] overflow-hidden rounded-lg border border-line bg-surface-raised",children:y.map(s=>e.jsxs(d,{children:[e.jsxs(l,{className:"flex h-10 items-center gap-3 border-b border-line px-3 text-sm last:border-b-0 data-[state=open]:bg-hover",children:[e.jsx("span",{className:"w-14 text-xs text-fg-subtle",children:s.id}),e.jsx("span",{className:"truncate",children:s.title})]}),e.jsxs(r,{className:"w-60",children:[e.jsx(g,{children:s.id}),e.jsxs(j,{children:[e.jsx(M,{icon:e.jsx(u,{}),children:"Status"}),e.jsx(f,{children:e.jsxs(S,{value:h,onValueChange:p,children:[e.jsx(a,{value:"backlog",children:e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx(v,{className:"size-4 text-fg-muted"}),"Backlog"]})}),e.jsx(a,{value:"todo",children:e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx(u,{className:"size-4 text-fg-muted"}),"Todo"]})}),e.jsx(a,{value:"done",children:e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx(k,{className:"size-4 text-fg-muted"}),"Done"]})})]})})]}),e.jsx(t,{icon:e.jsx(I,{}),shortcut:["⌘","L"],children:"Copy link"}),e.jsx(N,{checked:C,onCheckedChange:b,children:"Subscribed"}),e.jsx(x,{}),e.jsx(t,{icon:e.jsx(m,{}),tone:"danger",shortcut:["⌘","⌫"],children:"Delete issue"})]})]},s.id))})}},_=["Playground","IssueList"];o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:"{}",...o.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [status, setStatus] = useState("todo");
    const [subscribed, setSubscribed] = useState(true);
    return <div className="w-[30rem] overflow-hidden rounded-lg border border-line bg-surface-raised">
        {issues.map(issue => <ContextMenu key={issue.id}>
            <ContextMenuTrigger className="flex h-10 items-center gap-3 border-b border-line px-3 text-sm last:border-b-0 data-[state=open]:bg-hover">
              <span className="w-14 text-xs text-fg-subtle">{issue.id}</span>
              <span className="truncate">{issue.title}</span>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-60">
              <ContextMenuLabel>{issue.id}</ContextMenuLabel>
              <ContextMenuSub>
                <ContextMenuSubTrigger icon={<CircleDot />}>
                  Status
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuRadioGroup value={status} onValueChange={setStatus}>
                    <ContextMenuRadioItem value="backlog">
                      <span className="flex items-center gap-2">
                        <CircleDashed className="size-4 text-fg-muted" />
                        Backlog
                      </span>
                    </ContextMenuRadioItem>
                    <ContextMenuRadioItem value="todo">
                      <span className="flex items-center gap-2">
                        <CircleDot className="size-4 text-fg-muted" />
                        Todo
                      </span>
                    </ContextMenuRadioItem>
                    <ContextMenuRadioItem value="done">
                      <span className="flex items-center gap-2">
                        <CircleCheck className="size-4 text-fg-muted" />
                        Done
                      </span>
                    </ContextMenuRadioItem>
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuItem icon={<Link2 />} shortcut={["⌘", "L"]}>
                Copy link
              </ContextMenuItem>
              <ContextMenuCheckboxItem checked={subscribed} onCheckedChange={setSubscribed}>
                Subscribed
              </ContextMenuCheckboxItem>
              <ContextMenuSeparator />
              <ContextMenuItem icon={<Trash2 />} tone="danger" shortcut={["⌘", "⌫"]}>
                Delete issue
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>)}
      </div>;
  }
}`,...n.parameters?.docs?.source},description:{story:"Right-click any issue row.",...n.parameters?.docs?.description}}};export{n as IssueList,o as Playground,_ as __namedExportsOrder,V as default};
