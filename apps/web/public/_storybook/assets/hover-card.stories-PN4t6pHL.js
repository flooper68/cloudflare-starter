import{a6 as c,bZ as n,j as e,b_ as o,b$ as i,aY as m}from"./iframe-BjN4PNZi.js";import{C as x}from"./clock-CLisaoUw.js";import"./preload-helper-PPVm8Dsz.js";const d={name:"mail",size:24,node:[["path",{d:"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7",key:"132q7q"}],["rect",{x:"2",y:"4",width:"20",height:"16",rx:"2",key:"izxlao"}]]};d.node;const p=c(d),h={title:"Overlays/HoverCard",component:n,tags:["autodocs"],args:{side:"bottom",align:"start"},argTypes:{side:{control:"inline-radio",options:["top","right","bottom","left"]},align:{control:"inline-radio",options:["start","center","end"]}},render:s=>e.jsxs("p",{className:"text-sm text-fg-muted",children:["Assigned to"," ",e.jsxs(o,{children:[e.jsx(i,{href:"#tereza",className:"font-medium text-fg hover:underline",children:"Tereza Nováková"}),e.jsx(n,{...s,children:e.jsx(l,{})})]})," ","yesterday."]}),parameters:{docs:{description:{component:`A preview shown while hovering a link: a person, an issue, a project. It is not
reachable by keyboard or touch in a useful way, so it must only repeat information
the link's destination also shows.`}}}};function l(){return e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:"flex size-10 items-center justify-center rounded-full bg-accent-subtle text-sm font-semibold text-accent",children:"TN"}),e.jsxs("div",{className:"flex min-w-0 flex-col",children:[e.jsx("span",{className:"font-medium text-fg",children:"Tereza Nováková"}),e.jsx("span",{className:"text-xs text-fg-muted",children:"Staff engineer · Platform"})]})]}),e.jsxs("div",{className:"flex flex-col gap-1.5 text-xs text-fg-muted [&_svg]:size-3.5",children:[e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx(p,{}),"tereza@acme.dev"]}),e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx(x,{}),"16:42 local time (Prague)"]})]}),e.jsxs("div",{className:"flex gap-4 border-t border-line pt-3 text-xs text-fg-muted",children:[e.jsxs("span",{children:[e.jsx("span",{className:"font-medium text-fg",children:"12"})," assigned"]}),e.jsxs("span",{children:[e.jsx("span",{className:"font-medium text-fg",children:"4"})," in progress"]})]})]})}const t={},r={render:s=>e.jsx("div",{className:"h-64",children:e.jsxs(o,{defaultOpen:!0,children:[e.jsx(i,{href:"#tereza",className:"text-sm font-medium text-fg",children:"@tereza"}),e.jsx(n,{...s,children:e.jsx(l,{})})]})})},a={render:s=>e.jsx("div",{className:"h-48",children:e.jsxs(o,{defaultOpen:!0,children:[e.jsx(i,{href:"#mobile",className:"text-sm font-medium text-fg",children:"Mobile app v2"}),e.jsx(n,{...s,className:"w-80",children:e.jsxs("div",{className:"flex flex-col gap-2",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("span",{className:"font-medium",children:"Mobile app v2"}),e.jsx(m,{value:64,showValue:!0,label:"Project progress"})]}),e.jsx("p",{className:"text-xs text-fg-muted",children:"Rebuild onboarding and offline sync for iOS and Android. Target: Dec 12."}),e.jsx("span",{className:"text-xs text-fg-subtle",children:"Lead: Jakub Dvořák · 48 issues"})]})})]})})},v=["Playground","UserCard","ProjectCard"];t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: args => <div className="h-64">
      <HoverCard defaultOpen>
        <HoverCardTrigger href="#tereza" className="text-sm font-medium text-fg">
          @tereza
        </HoverCardTrigger>
        <HoverCardContent {...args}>
          <UserPreview />
        </HoverCardContent>
      </HoverCard>
    </div>
}`,...r.parameters?.docs?.source},description:{story:"Open by default, for the docs page.",...r.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: args => <div className="h-48">
      <HoverCard defaultOpen>
        <HoverCardTrigger href="#mobile" className="text-sm font-medium text-fg">
          Mobile app v2
        </HoverCardTrigger>
        <HoverCardContent {...args} className="w-80">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Mobile app v2</span>
              <ProgressRing value={64} showValue label="Project progress" />
            </div>
            <p className="text-xs text-fg-muted">
              Rebuild onboarding and offline sync for iOS and Android. Target:
              Dec 12.
            </p>
            <span className="text-xs text-fg-subtle">
              Lead: Jakub Dvořák · 48 issues
            </span>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
}`,...a.parameters?.docs?.source},description:{story:"Project preview on a project link.",...a.parameters?.docs?.description}}};export{t as Playground,a as ProjectCard,r as UserCard,v as __namedExportsOrder,h as default};
