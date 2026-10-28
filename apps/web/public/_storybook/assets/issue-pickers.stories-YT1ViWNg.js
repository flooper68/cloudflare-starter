import{bH as p,r as u,j as e,bI as f,B as d,bJ as P,x as m,bK as g,E as v,bL as x,bM as S,bN as j}from"./iframe-BjN4PNZi.js";import{b as h}from"./fixtures-CW67wZDI.js";import"./preload-helper-PPVm8Dsz.js";import"./circle-dashed-Divtlg0F.js";import"./signal-high-Dzb6_NUQ.js";import"./tag-D81nTkkR.js";import"./settings-ULeVwmos.js";import"./user-plus-DQ5D-oOB.js";import"./inbox-CXA9en-m.js";import"./layers-syhRhF9-.js";import"./copy-DjBACZ_m.js";const O={title:"Patterns/Pickers",component:p,tags:["autodocs"],args:{value:"in_progress",onValueChange:()=>{},children:null},argTypes:{children:{control:!1}},parameters:{docs:{description:{component:`Popover pickers on cmdk for an issue's status, priority and assignee: type to search,
↑/↓ and Enter, or press a number key to pick directly. The current value has a check.
The trigger is your own element, usually a glyph button.`}}}},i={render:function(s){const[r,o]=u.useState(s.value);return e.jsx(p,{value:r,onValueChange:o,children:e.jsx(d,{variant:"secondary",size:"sm",icon:e.jsx(m,{status:r}),children:g(r)})})}},a={parameters:{docs:{story:{height:"320px"}}},render:function(){const[s,r]=u.useState("todo");return e.jsx("div",{className:"h-80",children:e.jsx(p,{value:s,onValueChange:r,defaultOpen:!0,children:e.jsx(j,{label:`Status: ${g(s)}`,children:e.jsx(m,{status:s})})})})}},l={parameters:{docs:{story:{height:"300px"}}},render:function(){const[s,r]=u.useState("high");return e.jsx("div",{className:"h-72",children:e.jsx(S,{value:s,onValueChange:r,defaultOpen:!0,children:e.jsx(d,{variant:"secondary",size:"sm",icon:e.jsx(v,{priority:s}),children:x(s)})})})}},c={render:function(){const[s,r]=u.useState("u-chloe"),o=h.find(y=>y.id===s)??null;return e.jsx(f,{people:h,value:s,onValueChange:r,children:e.jsx(d,{variant:"secondary",size:"sm",icon:e.jsx(P,{person:o,size:"xs"}),children:o?.name??"Assign"})})}},t={render:()=>e.jsxs("div",{className:"grid grid-cols-2 gap-8 text-sm",children:[e.jsx("ul",{className:"flex flex-col gap-2",children:["backlog","todo","in_progress","in_review","done","canceled"].map(n=>e.jsxs("li",{className:"flex items-center gap-2",children:[e.jsx(m,{status:n}),g(n)]},n))}),e.jsx("ul",{className:"flex flex-col gap-2",children:["urgent","high","medium","low","none"].map(n=>e.jsxs("li",{className:"flex items-center gap-2",children:[e.jsx(v,{priority:n}),x(n)]},n))})]})},_=["Playground","StatusOpen","Priority","Assignee","Glyphs"];i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: function Render(args) {
    const [value, setValue] = useState<IssueStatus>(args.value);
    return <StatusPicker value={value} onValueChange={setValue}>
        <Button variant="secondary" size="sm" icon={<StatusIcon status={value} />}>
          {statusLabel(value)}
        </Button>
      </StatusPicker>;
  }
}`,...i.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  parameters: {
    docs: {
      story: {
        height: "320px"
      }
    }
  },
  render: function Render() {
    const [value, setValue] = useState<IssueStatus>("todo");
    return <div className="h-80">
        <StatusPicker value={value} onValueChange={setValue} defaultOpen>
          <GlyphButton label={\`Status: \${statusLabel(value)}\`}>
            <StatusIcon status={value} />
          </GlyphButton>
        </StatusPicker>
      </div>;
  }
}`,...a.parameters?.docs?.source},description:{story:"Open on load, so the docs page shows the list.",...a.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  parameters: {
    docs: {
      story: {
        height: "300px"
      }
    }
  },
  render: function Render() {
    const [value, setValue] = useState<IssuePriority>("high");
    return <div className="h-72">
        <PriorityPicker value={value} onValueChange={setValue} defaultOpen>
          <Button variant="secondary" size="sm" icon={<PriorityIcon priority={value} />}>
            {priorityLabel(value)}
          </Button>
        </PriorityPicker>
      </div>;
  }
}`,...l.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [value, setValue] = useState<string | null>("u-chloe");
    const person = allPeople.find(p => p.id === value) ?? null;
    return <AssigneePicker people={allPeople} value={value} onValueChange={setValue}>
        <Button variant="secondary" size="sm" icon={<PersonAvatar person={person} size="xs" />}>
          {person?.name ?? "Assign"}
        </Button>
      </AssigneePicker>;
  }
}`,...c.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => <div className="grid grid-cols-2 gap-8 text-sm">
      <ul className="flex flex-col gap-2">
        {(["backlog", "todo", "in_progress", "in_review", "done", "canceled"] as const).map(s => <li key={s} className="flex items-center gap-2">
            <StatusIcon status={s} />
            {statusLabel(s)}
          </li>)}
      </ul>
      <ul className="flex flex-col gap-2">
        {(["urgent", "high", "medium", "low", "none"] as const).map(p => <li key={p} className="flex items-center gap-2">
            <PriorityIcon priority={p} />
            {priorityLabel(p)}
          </li>)}
      </ul>
    </div>
}`,...t.parameters?.docs?.source},description:{story:"All glyphs, for reference.",...t.parameters?.docs?.description}}};export{c as Assignee,t as Glyphs,i as Playground,l as Priority,a as StatusOpen,_ as __namedExportsOrder,O as default};
