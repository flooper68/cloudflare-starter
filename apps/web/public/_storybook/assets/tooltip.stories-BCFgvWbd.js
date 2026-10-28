import{aS as s,j as o,I as t,P as n}from"./iframe-BjN4PNZi.js";import{L as c}from"./link-2-EvoKAGAX.js";import{B as i}from"./bell-CVea3eBz.js";import{A as a}from"./archive-vpGSa4fK.js";import"./preload-helper-PPVm8Dsz.js";const h={title:"Overlays/Tooltip",component:s,tags:["autodocs"],args:{content:"Create issue",shortcut:["C"],side:"top",children:o.jsx(t,{label:"Create issue",variant:"secondary",children:o.jsx(n,{})})},parameters:{docs:{description:{component:"A short hint on hover or focus, optionally with the keyboard shortcut."}}}},e={},r={render:()=>o.jsxs("div",{className:"flex gap-1 rounded-lg border border-line bg-surface p-1",children:[o.jsx(s,{content:"Copy link",shortcut:["⌘","⇧","C"],children:o.jsx(t,{label:"Copy link",size:"sm",children:o.jsx(c,{})})}),o.jsx(s,{content:"Subscribe",shortcut:["⇧","S"],children:o.jsx(t,{label:"Subscribe",size:"sm",children:o.jsx(i,{})})}),o.jsx(s,{content:"Archive",children:o.jsx(t,{label:"Archive",size:"sm",children:o.jsx(a,{})})})]})},b=["Playground","Toolbar"];e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
      <Tooltip content="Copy link" shortcut={["⌘", "⇧", "C"]}>
        <IconButton label="Copy link" size="sm">
          <Link2 />
        </IconButton>
      </Tooltip>
      <Tooltip content="Subscribe" shortcut={["⇧", "S"]}>
        <IconButton label="Subscribe" size="sm">
          <Bell />
        </IconButton>
      </Tooltip>
      <Tooltip content="Archive">
        <IconButton label="Archive" size="sm">
          <Archive />
        </IconButton>
      </Tooltip>
    </div>
}`,...r.parameters?.docs?.source}}};export{e as Playground,r as Toolbar,b as __namedExportsOrder,h as default};
