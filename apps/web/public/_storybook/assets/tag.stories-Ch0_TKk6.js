import{b6 as r,j as e,r as u}from"./iframe-BjN4PNZi.js";import{H as p}from"./hash-BA9V96Ja.js";import"./preload-helper-PPVm8Dsz.js";const h={title:"Data display/Tag",component:r,tags:["autodocs"],args:{children:"Bug",color:"danger",size:"md"},argTypes:{color:{control:"select",options:["neutral","accent","success","warning","danger","info"]},size:{control:"inline-radio",options:["sm","md"]}},parameters:{docs:{description:{component:"Tags (chips) show labels on an issue, active filters or chosen values. The colour dot\nmirrors Linear labels. Add `onRemove` for a × button (Backspace on it removes too)."}}}},s={},o={render:()=>e.jsxs("div",{className:"flex flex-wrap gap-1.5",children:[e.jsx(r,{color:"danger",children:"Bug"}),e.jsx(r,{color:"accent",children:"Feature"}),e.jsx(r,{color:"info",children:"Improvement"}),e.jsx(r,{color:"warning",children:"Performance"}),e.jsx(r,{color:"success",children:"Design"}),e.jsx(r,{color:"neutral",children:"Tech debt"}),e.jsx(r,{icon:e.jsx(p,{}),children:"frontend"})]})},n={render:()=>e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(r,{size:"sm",color:"accent",children:"Feature"}),e.jsx(r,{size:"md",color:"accent",children:"Feature"})]})},d=[{label:"Status: In Progress",color:"warning"},{label:"Assignee: Ada Lovelace",color:"accent"},{label:"Label: Bug",color:"danger"}],t={render:()=>{const[c,i]=u.useState(d);return e.jsxs("div",{className:"flex flex-wrap items-center gap-1.5",children:[c.map(a=>e.jsx(r,{color:a.color,onRemove:()=>i(m=>m.filter(g=>g.label!==a.label)),children:a.label},a.label)),c.length===0?e.jsx("button",{type:"button",className:"text-xs text-fg-muted hover:text-fg",onClick:()=>i(d),children:"Reset filters"}):null]})}},l={render:()=>e.jsx("div",{className:"w-48",children:e.jsx(r,{color:"info",children:"Customer request: enterprise SSO via Okta"})})},b=["Playground","Labels","Sizes","Removable","Truncated"];s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap gap-1.5">
      <Tag color="danger">Bug</Tag>
      <Tag color="accent">Feature</Tag>
      <Tag color="info">Improvement</Tag>
      <Tag color="warning">Performance</Tag>
      <Tag color="success">Design</Tag>
      <Tag color="neutral">Tech debt</Tag>
      <Tag icon={<Hash />}>frontend</Tag>
    </div>
}`,...o.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-2">
      <Tag size="sm" color="accent">
        Feature
      </Tag>
      <Tag size="md" color="accent">
        Feature
      </Tag>
    </div>
}`,...n.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => {
    const [filters, setFilters] = useState(initialFilters);
    return <div className="flex flex-wrap items-center gap-1.5">
        {filters.map(filter => <Tag key={filter.label} color={filter.color} onRemove={() => setFilters(all => all.filter(f => f.label !== filter.label))}>
            {filter.label}
          </Tag>)}
        {filters.length === 0 ? <button type="button" className="text-xs text-fg-muted hover:text-fg" onClick={() => setFilters(initialFilters)}>
            Reset filters
          </button> : null}
      </div>;
  }
}`,...t.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <div className="w-48">
      <Tag color="info">Customer request: enterprise SSO via Okta</Tag>
    </div>
}`,...l.parameters?.docs?.source}}};export{o as Labels,s as Playground,t as Removable,n as Sizes,l as Truncated,b as __namedExportsOrder,h as default};
