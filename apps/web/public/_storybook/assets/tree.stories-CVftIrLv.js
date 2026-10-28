import{br as i,r as p,j as e,x as a}from"./iframe-BjN4PNZi.js";import{D as n}from"./diamond-CyqMcsMe.js";import{F as x}from"./folder-kanban-YNL2kew5.js";import{L as g,B as b}from"./layers-syhRhF9-.js";import"./preload-helper-PPVm8Dsz.js";const f=[{id:"mobile",label:"Mobile app v3",icon:e.jsx(x,{}),trailing:"14/32",children:[{id:"mobile-m1",label:"Offline sync",icon:e.jsx(n,{}),trailing:"6/10",children:[{id:"ENG-412",label:"Sync stalls when the device goes offline",icon:e.jsx(a,{status:"in_progress",label:""})},{id:"ENG-398",label:"Persist upload queue",icon:e.jsx(a,{status:"in_review",label:""})},{id:"ENG-371",label:"Conflict resolution UI",icon:e.jsx(a,{status:"todo",label:""})}]},{id:"mobile-m2",label:"Push notifications",icon:e.jsx(n,{}),trailing:"8/8",children:[{id:"ENG-340",label:"Swipe to archive notification",icon:e.jsx(a,{status:"done",label:""})}]},{id:"mobile-m3",label:"Tablet layout",icon:e.jsx(n,{}),trailing:"0/14",disabled:!0}]},{id:"billing",label:"Billing v2",icon:e.jsx(x,{}),trailing:"11/18",children:[{id:"billing-m1",label:"Usage-based pricing",icon:e.jsx(n,{}),children:[{id:"ENG-388",label:"Meter API calls per workspace",icon:e.jsx(a,{status:"in_progress",label:""})}]},{id:"billing-m2",label:"Invoices",icon:e.jsx(n,{})}]},{id:"infra",label:"Platform",icon:e.jsx(g,{}),trailing:"0/0"},{id:"misc",label:"Unsorted",icon:e.jsx(b,{})}],v={title:"Data display/Tree",component:i,tags:["autodocs"],args:{items:f,label:"Projects",defaultExpanded:["mobile","mobile-m1"],defaultSelected:"ENG-412"},decorators:[s=>e.jsx("div",{className:"w-80",children:e.jsx(s,{})})],parameters:{docs:{description:{component:"A nested, collapsible tree (projects › milestones › issues). Click or press Enter to\nselect; ←/→ collapse and expand, ↑/↓ move, Home/End jump, `*` expands all siblings."}}}},l={},t={args:{defaultExpanded:[],defaultSelected:null}},r={render:s=>{const[d,m]=p.useState(["billing"]),[c,u]=p.useState("billing-m1");return e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(i,{...s,expanded:d,onExpandedChange:m,selected:c,onSelectedChange:u}),e.jsxs("p",{className:"text-xs text-fg-muted",children:["Selected: ",e.jsx("span",{className:"text-fg",children:c??"nothing"})," · Expanded: ",d.join(", ")||"none"]})]})}},o={render:s=>e.jsxs("nav",{className:"flex w-64 flex-col gap-2 rounded-lg border border-line bg-surface p-2",children:[e.jsx("span",{className:"px-2 pt-1 text-xs font-medium text-fg-subtle",children:"Your projects"}),e.jsx(i,{...s})]})},C=["Playground","Collapsed","Controlled","InSidebar"];l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:"{}",...l.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    defaultExpanded: [],
    defaultSelected: null
  }
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: args => {
    const [expanded, setExpanded] = useState<string[]>(["billing"]);
    const [selected, setSelected] = useState<string | null>("billing-m1");
    return <div className="flex flex-col gap-3">
        <Tree {...args} expanded={expanded} onExpandedChange={setExpanded} selected={selected} onSelectedChange={setSelected} />
        <p className="text-xs text-fg-muted">
          Selected: <span className="text-fg">{selected ?? "nothing"}</span> ·
          Expanded: {expanded.join(", ") || "none"}
        </p>
      </div>;
  }
}`,...r.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: args => <nav className="flex w-64 flex-col gap-2 rounded-lg border border-line bg-surface p-2">
      <span className="px-2 pt-1 text-xs font-medium text-fg-subtle">
        Your projects
      </span>
      <Tree {...args} />
    </nav>
}`,...o.parameters?.docs?.source}}};export{t as Collapsed,r as Controlled,o as InSidebar,l as Playground,C as __namedExportsOrder,v as default};
