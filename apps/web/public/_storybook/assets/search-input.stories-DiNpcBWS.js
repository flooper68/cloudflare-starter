import{U as o,r as g,j as e,x}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const y={title:"Forms/SearchInput",component:o,tags:["autodocs"],args:{placeholder:"Search issues…",size:"md",disabled:!1,"aria-label":"Search issues",className:"w-72"},argTypes:{size:{control:"inline-radio",options:["sm","md","lg"]},shortcut:{control:"inline-radio",options:[void 0,"/","mod+k"]}},parameters:{docs:{description:{component:"A search field with a clear button and an optional focus shortcut (`/` or ⌘K) shown as a\nhint while empty. Escape clears, then leaves the field."}}}},i={},t={args:{shortcut:"/"}},r={args:{shortcut:"mod+k",placeholder:"Search or jump to…"}},c={args:{defaultValue:"people picker"}},l={render:n=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(o,{...n,size:"sm"}),e.jsx(o,{...n,size:"md"}),e.jsx(o,{...n,size:"lg"})]})},u={args:{disabled:!0}},f=[{id:"ENG-2148",title:"Slow people picker in large workspaces",status:"in_progress"},{id:"ENG-2131",title:"Sync conflicts when editing offline",status:"todo"},{id:"DES-412",title:"New empty state for the inbox",status:"in_review"},{id:"ENG-2090",title:"Rate limit the public API per token",status:"done"},{id:"MOB-77",title:"Push notifications open the wrong issue",status:"backlog"}],a={render:function(){const[d,h]=g.useState(""),p=d.trim().toLowerCase(),m=f.filter(s=>s.title.toLowerCase().includes(p)||s.id.toLowerCase().includes(p));return e.jsxs("div",{className:"flex w-[420px] flex-col gap-2",children:[e.jsx(o,{value:d,onValueChange:h,shortcut:"/",placeholder:"Filter issues…","aria-label":"Filter issues"}),e.jsxs("ul",{className:"flex flex-col rounded-lg border border-line bg-surface-raised p-1",children:[m.map(s=>e.jsxs("li",{className:"flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-hover",children:[e.jsx(x,{status:s.status,label:""}),e.jsx("span",{className:"w-16 shrink-0 text-fg-subtle text-xs",children:s.id}),e.jsx("span",{className:"truncate text-fg",children:s.title})]},s.id)),m.length===0?e.jsxs("li",{className:"px-2 py-6 text-center text-fg-subtle text-sm",children:['No issues match "',d,'"']}):null]})]})}},w=["Playground","SlashShortcut","CommandKShortcut","WithValue","Sizes","Disabled","FilteringAList"];i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:"{}",...i.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    shortcut: "/"
  }
}`,...t.parameters?.docs?.source},description:{story:'Press "/" anywhere on the page to focus the field.',...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    shortcut: "mod+k",
    placeholder: "Search or jump to…"
  }
}`,...r.parameters?.docs?.source},description:{story:"Press ⌘K (Ctrl+K) to focus the field.",...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: "people picker"
  }
}`,...c.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex flex-col gap-3">
      <SearchInput {...args} size="sm" />
      <SearchInput {...args} size="md" />
      <SearchInput {...args} size="lg" />
    </div>
}`,...l.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...u.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [query, setQuery] = useState("");
    const needle = query.trim().toLowerCase();
    const matches = issues.filter(issue => issue.title.toLowerCase().includes(needle) || issue.id.toLowerCase().includes(needle));
    return <div className="flex w-[420px] flex-col gap-2">
        <SearchInput value={query} onValueChange={setQuery} shortcut="/" placeholder="Filter issues…" aria-label="Filter issues" />
        <ul className="flex flex-col rounded-lg border border-line bg-surface-raised p-1">
          {matches.map(issue => <li key={issue.id} className="flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-hover">
              <StatusIcon status={issue.status} label="" />
              <span className="w-16 shrink-0 text-fg-subtle text-xs">
                {issue.id}
              </span>
              <span className="truncate text-fg">{issue.title}</span>
            </li>)}
          {matches.length === 0 ? <li className="px-2 py-6 text-center text-fg-subtle text-sm">
              No issues match "{query}"
            </li> : null}
        </ul>
      </div>;
  }
}`,...a.parameters?.docs?.source},description:{story:'Filtering a list as you type; "No results" when nothing matches.',...a.parameters?.docs?.description}}};export{r as CommandKShortcut,u as Disabled,a as FilteringAList,i as Playground,l as Sizes,t as SlashShortcut,c as WithValue,w as __namedExportsOrder,y as default};
