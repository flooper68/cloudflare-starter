import{bs as c,j as e,x as i}from"./iframe-BjN4PNZi.js";import{U as o}from"./users-CrbWFYk8.js";import{F as l}from"./folder-kanban-YNL2kew5.js";import{D as m}from"./diamond-CyqMcsMe.js";import"./preload-helper-PPVm8Dsz.js";const u={title:"Navigation/Breadcrumbs",component:c,tags:["autodocs"],args:{items:[{label:"Engineering",href:"#team",icon:e.jsx(o,{})},{label:"Projects",href:"#projects"},{label:"Mobile app v3",href:"#project",icon:e.jsx(l,{})}],maxItems:4},parameters:{docs:{description:{component:'Where the current page sits in the hierarchy. The last item is the current page; long\ntrails collapse the middle into a "…" menu (`maxItems`).'}}}},s={},a={args:{items:[{label:"Engineering",href:"#team",icon:e.jsx(o,{})},{label:"Projects",href:"#projects"},{label:"Mobile app v3",href:"#project",icon:e.jsx(l,{})},{label:"Offline sync",href:"#milestone",icon:e.jsx(m,{})},{label:"ENG-398",href:"#parent"},{label:"ENG-412 Sync stalls when offline",icon:e.jsx(i,{status:"in_progress",label:""})}],maxItems:4}},r={args:{separator:e.jsx("span",{className:"px-0.5 text-fg-subtle",children:"/"}),items:[{label:"acme",href:"#workspace"},{label:"settings",href:"#settings"},{label:"api"}]}},n={args:{items:[{label:"Inbox"}]}},t={render:()=>e.jsxs("header",{className:"flex h-11 w-[640px] items-center justify-between border-b border-line px-3",children:[e.jsx(c,{items:[{label:"Engineering",href:"#team",icon:e.jsx(o,{})},{label:"Mobile app v3",href:"#project",icon:e.jsx(l,{})},{label:"ENG-412",icon:e.jsx(i,{status:"in_progress",label:""})}]}),e.jsx("span",{className:"text-xs text-fg-subtle",children:"3 / 32"})]})},x=["Playground","Collapsed","CustomSeparator","SingleItem","InHeader"];s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    items: [{
      label: "Engineering",
      href: "#team",
      icon: <Users />
    }, {
      label: "Projects",
      href: "#projects"
    }, {
      label: "Mobile app v3",
      href: "#project",
      icon: <FolderKanban />
    }, {
      label: "Offline sync",
      href: "#milestone",
      icon: <Diamond />
    }, {
      label: "ENG-398",
      href: "#parent"
    }, {
      label: "ENG-412 Sync stalls when offline",
      icon: <StatusIcon status="in_progress" label="" />
    }],
    maxItems: 4
  }
}`,...a.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    separator: <span className="px-0.5 text-fg-subtle">/</span>,
    items: [{
      label: "acme",
      href: "#workspace"
    }, {
      label: "settings",
      href: "#settings"
    }, {
      label: "api"
    }]
  }
}`,...r.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    items: [{
      label: "Inbox"
    }]
  }
}`,...n.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => <header className="flex h-11 w-[640px] items-center justify-between border-b border-line px-3">
      <Breadcrumbs items={[{
      label: "Engineering",
      href: "#team",
      icon: <Users />
    }, {
      label: "Mobile app v3",
      href: "#project",
      icon: <FolderKanban />
    }, {
      label: "ENG-412",
      icon: <StatusIcon status="in_progress" label="" />
    }]} />
      <span className="text-xs text-fg-subtle">3 / 32</span>
    </header>
}`,...t.parameters?.docs?.source}}};export{a as Collapsed,r as CustomSeparator,t as InHeader,s as Playground,n as SingleItem,x as __namedExportsOrder,u as default};
