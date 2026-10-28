import{B as n,j as e,I as r,P as l,S as u}from"./iframe-BjN4PNZi.js";import{S as m}from"./settings-ULeVwmos.js";import{A as p}from"./arrow-right-dmFOCM8o.js";import{S as g}from"./star-D2CNP4VL.js";import{T as x}from"./trash-D4pgkLAF.js";import"./preload-helper-PPVm8Dsz.js";const f={title:"Actions/Button",component:n,tags:["autodocs"],args:{children:"Create issue",variant:"primary",size:"md",disabled:!1,loading:!1},argTypes:{variant:{control:"select",options:["primary","secondary","ghost","danger","link"]},size:{control:"inline-radio",options:["xs","sm","md","lg"]}},parameters:{docs:{description:{component:"Buttons trigger actions. Use one `primary` per view for the main action, `secondary`\nfor everyday actions, `ghost` in toolbars and menus, `danger` only to confirm\nsomething destructive."}}}},t={},a={render:()=>e.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[e.jsx(n,{variant:"primary",children:"Primary"}),e.jsx(n,{variant:"secondary",children:"Secondary"}),e.jsx(n,{variant:"ghost",children:"Ghost"}),e.jsx(n,{variant:"danger",children:"Delete"}),e.jsx(n,{variant:"link",children:"Learn more"})]})},s={render:()=>e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(n,{size:"xs",children:"Extra small"}),e.jsx(n,{size:"sm",children:"Small"}),e.jsx(n,{size:"md",children:"Medium"}),e.jsx(n,{size:"lg",children:"Large"})]})},i={render:()=>e.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[e.jsx(n,{variant:"primary",icon:e.jsx(l,{}),children:"New issue"}),e.jsx(n,{trailing:e.jsx(p,{}),children:"Continue"}),e.jsx(n,{variant:"ghost",icon:e.jsx(g,{}),trailing:e.jsx(u,{keys:["F"]}),children:"Favorite"}),e.jsx(n,{variant:"danger",icon:e.jsx(x,{}),children:"Delete project"})]})},o={render:()=>e.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[e.jsx(n,{variant:"primary",loading:!0,children:"Saving"}),e.jsx(n,{loading:!0,children:"Syncing"}),e.jsx(n,{variant:"primary",disabled:!0,children:"Disabled"}),e.jsx(n,{disabled:!0,children:"Disabled"})]})},c={render:()=>e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(r,{label:"Settings",size:"sm",children:e.jsx(m,{})}),e.jsx(r,{label:"Settings",children:e.jsx(m,{})}),e.jsx(r,{label:"Add",variant:"secondary",children:e.jsx(l,{})}),e.jsx(r,{label:"Add",variant:"primary",children:e.jsx(l,{})})]})},d={render:()=>e.jsx(n,{asChild:!0,variant:"secondary",children:e.jsx("a",{href:"#docs",children:"Open documentation"})})},b=["Playground","Variants","Sizes","WithIcons","States","IconButtons","AsLink"];t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Delete</Button>
      <Button variant="link">Learn more</Button>
    </div>
}`,...a.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
}`,...s.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" icon={<Plus />}>
        New issue
      </Button>
      <Button trailing={<ArrowRight />}>Continue</Button>
      <Button variant="ghost" icon={<Star />} trailing={<Shortcut keys={["F"]} />}>
        Favorite
      </Button>
      <Button variant="danger" icon={<Trash2 />}>
        Delete project
      </Button>
    </div>
}`,...i.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" loading>
        Saving
      </Button>
      <Button loading>Syncing</Button>
      <Button variant="primary" disabled>
        Disabled
      </Button>
      <Button disabled>Disabled</Button>
    </div>
}`,...o.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-2">
      <IconButton label="Settings" size="sm">
        <Settings />
      </IconButton>
      <IconButton label="Settings">
        <Settings />
      </IconButton>
      <IconButton label="Add" variant="secondary">
        <Plus />
      </IconButton>
      <IconButton label="Add" variant="primary">
        <Plus />
      </IconButton>
    </div>
}`,...c.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <Button asChild variant="secondary">
      <a href="#docs">Open documentation</a>
    </Button>
}`,...d.parameters?.docs?.source}}};export{d as AsLink,c as IconButtons,t as Playground,s as Sizes,o as States,a as Variants,i as WithIcons,b as __namedExportsOrder,f as default};
