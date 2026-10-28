import{ak as n,j as e,al as p,am as h,B as r,an as m,ao as u,ap as g,aq as x,ar as j,as as o,F as C,p as y,r as v,S as z,at as T}from"./iframe-BjN4PNZi.js";import{C as k}from"./circle-dashed-Divtlg0F.js";import{S as F}from"./signal-high-Dzb6_NUQ.js";import{C as I}from"./circle-user-ILjuPnhn.js";import"./preload-helper-PPVm8Dsz.js";const R={title:"Overlays/Dialog",component:n,tags:["autodocs"],args:{size:"md",showClose:!0},argTypes:{size:{control:"inline-radio",options:["sm","md","lg","xl","full"]}},render:s=>e.jsxs(p,{children:[e.jsx(h,{asChild:!0,children:e.jsx(r,{children:"Rename project"})}),e.jsxs(n,{...s,children:[e.jsxs(m,{children:[e.jsx(u,{children:"Rename project"}),e.jsx(g,{children:"Everyone in the Engineering team will see the new name."})]}),e.jsx(x,{children:e.jsx(C,{label:"Name",children:e.jsx(y,{defaultValue:"Mobile app v2"})})}),e.jsxs(j,{children:[e.jsx(o,{asChild:!0,children:e.jsx(r,{variant:"ghost",children:"Cancel"})}),e.jsx(o,{asChild:!0,children:e.jsx(r,{variant:"primary",children:"Save"})})]})]})]}),parameters:{docs:{description:{component:"A modal for focused tasks: create an issue, rename a project, invite people. Focus is\ntrapped inside; Escape or a click on the backdrop closes it. Sizes `sm` to `xl` and\n`full`. Compose `DialogHeader`, `DialogBody` (scrolls when tall) and `DialogFooter`\n(actions right-aligned). For destructive confirmations use AlertDialog."}}}},w={docs:{story:{inline:!1,iframeHeight:560}}},t={},c={render:()=>e.jsx("div",{className:"flex flex-wrap gap-2",children:["sm","md","lg","xl","full"].map(s=>e.jsxs(p,{children:[e.jsx(h,{asChild:!0,children:e.jsx(r,{children:s})}),e.jsxs(n,{size:s,children:[e.jsxs(m,{children:[e.jsxs(u,{children:["Size “",s,"”"]}),e.jsx(g,{children:"The width adapts; the height follows the content up to the viewport."})]}),e.jsx(x,{children:e.jsx("p",{className:"text-fg-muted",children:"Use sm for confirmations, md for small forms, lg and xl for richer editors, full for views like a document preview."})}),e.jsx(j,{children:e.jsx(o,{asChild:!0,children:e.jsx(r,{children:"Close"})})})]})]},s))})},H=["Sub-issues now inherit the parent's project and cycle.","Triage: accept or decline issues with 1 and 2.","Projects show a progress ring based on completed scope.","GitHub: pull requests link to issues by branch name.","Slack: notifications for status changes in followed projects.","Command palette: “Change status…” works on selections.","Cycles: unfinished issues roll over automatically.","Views: filter by label groups and by estimate.","Inbox: snooze until a date or until the next cycle.","API: webhooks for project updates.","Search: results ranked by recent activity.","Templates: default assignee per team."],a={parameters:w,render:()=>e.jsxs(p,{defaultOpen:!0,children:[e.jsx(h,{asChild:!0,children:e.jsx(r,{children:"What’s new"})}),e.jsxs(n,{size:"md",className:"h-[420px]",children:[e.jsxs(m,{children:[e.jsx(u,{children:"What’s new in October"}),e.jsx(g,{children:"12 improvements since your last visit."})]}),e.jsx(x,{children:e.jsx("ul",{className:"flex flex-col gap-3",children:H.map(s=>e.jsx("li",{className:"rounded-md border border-line p-3",children:s},s))})}),e.jsx(j,{separated:!0,children:e.jsx(o,{asChild:!0,children:e.jsx(r,{variant:"primary",children:"Got it"})})})]})]})};function D({icon:s,children:l}){return e.jsx(r,{size:"xs",icon:s,children:l})}function E({defaultOpen:s=!1}){const[l,b]=v.useState(""),[S,N]=v.useState(!1),B=S&&l.trim()===""?"Give the issue a title":null;return e.jsxs(p,{defaultOpen:s,children:[e.jsx(h,{asChild:!0,children:e.jsx(r,{variant:"primary",trailing:e.jsx(z,{keys:["C"]}),children:"New issue"})}),e.jsx(n,{size:"lg",children:e.jsxs("form",{className:"flex min-h-0 flex-1 flex-col",onSubmit:f=>{f.preventDefault(),N(!0)},children:[e.jsxs(m,{children:[e.jsxs("div",{className:"flex items-center gap-1.5 text-xs text-fg-muted",children:[e.jsx("span",{className:"rounded-sm bg-hover px-1.5 py-0.5 font-medium",children:"ENG"}),e.jsx("span",{children:"›"}),e.jsx("span",{children:"New issue"})]}),e.jsx(u,{className:"sr-only",children:"Create issue"}),e.jsx(g,{className:"sr-only",children:"Create an issue in the Engineering team."})]}),e.jsxs(x,{className:"flex flex-col gap-4",children:[e.jsx(C,{label:"Title",error:B,children:e.jsx(y,{placeholder:"Issue title",value:l,onChange:f=>b(f.target.value)})}),e.jsx(C,{label:"Description",optional:!0,children:e.jsx(y,{placeholder:"Add a description…"})}),e.jsxs("div",{className:"flex flex-wrap gap-1.5",children:[e.jsx(D,{icon:e.jsx(k,{}),children:"Backlog"}),e.jsx(D,{icon:e.jsx(F,{}),children:"Priority"}),e.jsx(D,{icon:e.jsx(I,{}),children:"Assignee"})]})]}),e.jsxs(j,{separated:!0,children:[e.jsx(r,{variant:"ghost",size:"sm",icon:e.jsx(T,{}),className:"mr-auto",children:"Attach"}),e.jsx(o,{asChild:!0,children:e.jsx(r,{size:"sm",children:"Cancel"})}),e.jsx(r,{type:"submit",variant:"primary",size:"sm",children:"Create issue"})]})]})})]})}const i={parameters:w,render:()=>e.jsx(E,{defaultOpen:!0})},d={args:{showClose:!1}},U=["Playground","Sizes","ScrollingBody","CreateIssue","WithoutCloseButton"];t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap gap-2">
      {(["sm", "md", "lg", "xl", "full"] as const).map(size => <Dialog key={size}>
          <DialogTrigger asChild>
            <Button>{size}</Button>
          </DialogTrigger>
          <DialogContent size={size}>
            <DialogHeader>
              <DialogTitle>Size “{size}”</DialogTitle>
              <DialogDescription>
                The width adapts; the height follows the content up to the
                viewport.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <p className="text-fg-muted">
                Use sm for confirmations, md for small forms, lg and xl for
                richer editors, full for views like a document preview.
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>)}
    </div>
}`,...c.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: openInFrame,
  render: () => <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button>What’s new</Button>
      </DialogTrigger>
      <DialogContent size="md" className="h-[420px]">
        <DialogHeader>
          <DialogTitle>What’s new in October</DialogTitle>
          <DialogDescription>
            12 improvements since your last visit.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="flex flex-col gap-3">
            {changelog.map(entry => <li key={entry} className="rounded-md border border-line p-3">
                {entry}
              </li>)}
          </ul>
        </DialogBody>
        <DialogFooter separated>
          <DialogClose asChild>
            <Button variant="primary">Got it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
}`,...a.parameters?.docs?.source},description:{story:"A long body scrolls between the fixed header and footer.",...a.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  parameters: openInFrame,
  render: () => <CreateIssueDialog defaultOpen />
}`,...i.parameters?.docs?.source},description:{story:"Linear's “Create issue” modal: breadcrumb, fields, property chips, footer actions.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    showClose: false
  }
}`,...d.parameters?.docs?.source}}};export{i as CreateIssue,t as Playground,a as ScrollingBody,c as Sizes,d as WithoutCloseButton,U as __namedExportsOrder,R as default};
