import{a6 as t,p as a,j as e,K as i,bY as c}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const d={name:"at-sign",size:24,node:[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8",key:"7n84p3"}]]};d.node;const p=t(d),x={title:"Forms/Input",component:a,tags:["autodocs"],args:{placeholder:"Issue title",size:"md",disabled:!1},argTypes:{size:{control:"inline-radio",options:["sm","md","lg"]}},decorators:[o=>e.jsx("div",{className:"w-80",children:e.jsx(o,{})})],parameters:{docs:{description:{component:"Single-line text field. Use inside `Field` for a label, help text and errors."}}}},s={},r={render:()=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(a,{size:"sm",placeholder:"Small"}),e.jsx(a,{size:"md",placeholder:"Medium"}),e.jsx(a,{size:"lg",placeholder:"Large"})]})},l={render:()=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(a,{leading:e.jsx(c,{}),trailing:e.jsx(i,{children:"/"}),placeholder:"Search issues"}),e.jsx(a,{leading:e.jsx(p,{}),placeholder:"username"}),e.jsx(a,{trailing:e.jsx("span",{className:"text-xs",children:"hours"}),defaultValue:"4"})]})},n={render:()=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(a,{defaultValue:"Fix login redirect loop"}),e.jsx(a,{"aria-invalid":!0,defaultValue:"no-reply@"}),e.jsx(a,{disabled:!0,placeholder:"Disabled"}),e.jsx(a,{readOnly:!0,defaultValue:"ENG-1284"})]})},g=["Playground","Sizes","WithAdornments","States"];s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-3">
      <Input size="sm" placeholder="Small" />
      <Input size="md" placeholder="Medium" />
      <Input size="lg" placeholder="Large" />
    </div>
}`,...r.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-3">
      <Input leading={<Search />} trailing={<Kbd>/</Kbd>} placeholder="Search issues" />
      <Input leading={<AtSign />} placeholder="username" />
      <Input trailing={<span className="text-xs">hours</span>} defaultValue="4" />
    </div>
}`,...l.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-3">
      <Input defaultValue="Fix login redirect loop" />
      <Input aria-invalid defaultValue="no-reply@" />
      <Input disabled placeholder="Disabled" />
      <Input readOnly defaultValue="ENG-1284" />
    </div>
}`,...n.parameters?.docs?.source}}};export{s as Playground,r as Sizes,n as States,l as WithAdornments,g as __namedExportsOrder,x as default};
