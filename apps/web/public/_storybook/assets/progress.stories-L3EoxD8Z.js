import{aX as a,r as g,j as e,C as v,aY as r}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const h={title:"Feedback/Progress",component:a,tags:["autodocs"],args:{value:42,size:"md",tone:"accent",label:"Uploading attachments"},argTypes:{value:{control:{type:"range",min:0,max:100}},size:{control:"inline-radio",options:["sm","md","lg"]},tone:{control:"inline-radio",options:["accent","success","warning","danger"]}},decorators:[s=>e.jsx("div",{className:"w-80",children:e.jsx(s,{})})],parameters:{docs:{description:{component:"`Progress` is a thin bar: determinate with `value`, looping without it (unknown\nlength). `ProgressRing` is the small circle Linear shows next to projects and cycles,\noptionally with the percentage; it turns green at 100%."}}}},t={},o={render:()=>e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsx(a,{size:"sm",value:30,label:"Small"}),e.jsx(a,{size:"md",value:55,label:"Medium"}),e.jsx(a,{size:"lg",value:80,label:"Large"})]})},i={render:()=>e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsx(a,{tone:"accent",value:40,label:"Accent"}),e.jsx(a,{tone:"success",value:100,label:"Success"}),e.jsx(a,{tone:"warning",value:85,label:"Warning"}),e.jsx(a,{tone:"danger",value:97,label:"Danger"})]})},c={args:{value:null,label:"Importing issues"}},n={render:function(){const[u,p]=g.useState(0);return g.useEffect(()=>{const x=setInterval(()=>p(m=>m>=100?0:m+7),400);return()=>clearInterval(x)},[]),e.jsxs("div",{className:"flex flex-col gap-2 text-xs text-fg-muted",children:[e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{children:"design-review.fig"}),e.jsxs("span",{className:"tabular-nums",children:[Math.min(u,100),"%"]})]}),e.jsx(a,{value:Math.min(u,100),label:"Uploading design-review.fig"})]})}},d={render:()=>e.jsxs("div",{className:"flex items-center gap-6",children:[e.jsx(r,{value:0,label:"Not started"}),e.jsx(r,{value:25,label:"25%"}),e.jsx(r,{value:64,showValue:!0,label:"64%"}),e.jsx(r,{value:100,showValue:!0,label:"Done"}),e.jsx(r,{value:42,size:"sm",showValue:!0,label:"Small"}),e.jsx(r,{value:72,size:"lg",showValue:!0,label:"Large"}),e.jsx(r,{value:90,tone:"warning",size:"lg",showValue:!0,label:"At risk"})]})},b=[{name:"Mobile app v2",lead:"Jakub Dvořák",progress:64,target:"Dec 12"},{name:"Billing migration",lead:"Marie Svobodová",progress:100,target:"Oct 20"},{name:"Public API rate limits",lead:"Tereza Nováková",progress:18,target:"Jan 15"}],l={decorators:[s=>e.jsx("div",{className:"w-[32rem]",children:e.jsx(s,{})})],render:()=>e.jsx(v,{className:"p-0",children:b.map(s=>e.jsxs("div",{className:"flex h-11 items-center gap-3 border-b border-line px-4 text-sm last:border-b-0",children:[e.jsx("span",{className:"flex-1 truncate font-medium",children:s.name}),e.jsx("span",{className:"w-32 truncate text-xs text-fg-muted",children:s.lead}),e.jsx("span",{className:"w-14 text-xs text-fg-subtle",children:s.target}),e.jsx(r,{value:s.progress,showValue:!0,label:`${s.name} progress`,className:"w-14"})]},s.name))})},w=["Playground","Sizes","Tones","Indeterminate","Animated","Rings","ProjectList"];t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-4">
      <Progress size="sm" value={30} label="Small" />
      <Progress size="md" value={55} label="Medium" />
      <Progress size="lg" value={80} label="Large" />
    </div>
}`,...o.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-4">
      <Progress tone="accent" value={40} label="Accent" />
      <Progress tone="success" value={100} label="Success" />
      <Progress tone="warning" value={85} label="Warning" />
      <Progress tone="danger" value={97} label="Danger" />
    </div>
}`,...i.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    value: null,
    label: "Importing issues"
  }
}`,...c.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [value, setValue] = useState(0);
    useEffect(() => {
      const timer = setInterval(() => setValue(current => current >= 100 ? 0 : current + 7), 400);
      return () => clearInterval(timer);
    }, []);
    return <div className="flex flex-col gap-2 text-xs text-fg-muted">
        <div className="flex justify-between">
          <span>design-review.fig</span>
          <span className="tabular-nums">{Math.min(value, 100)}%</span>
        </div>
        <Progress value={Math.min(value, 100)} label="Uploading design-review.fig" />
      </div>;
  }
}`,...n.parameters?.docs?.source},description:{story:"Fills over time, like a file upload.",...n.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-6">
      <ProgressRing value={0} label="Not started" />
      <ProgressRing value={25} label="25%" />
      <ProgressRing value={64} showValue label="64%" />
      <ProgressRing value={100} showValue label="Done" />
      <ProgressRing value={42} size="sm" showValue label="Small" />
      <ProgressRing value={72} size="lg" showValue label="Large" />
      <ProgressRing value={90} tone="warning" size="lg" showValue label="At risk" />
    </div>
}`,...d.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  decorators: [Story => <div className="w-[32rem]">
        <Story />
      </div>],
  render: () => <Card className="p-0">
      {projects.map(project => <div key={project.name} className="flex h-11 items-center gap-3 border-b border-line px-4 text-sm last:border-b-0">
          <span className="flex-1 truncate font-medium">{project.name}</span>
          <span className="w-32 truncate text-xs text-fg-muted">
            {project.lead}
          </span>
          <span className="w-14 text-xs text-fg-subtle">{project.target}</span>
          <ProgressRing value={project.progress} showValue label={\`\${project.name} progress\`} className="w-14" />
        </div>)}
    </Card>
}`,...l.parameters?.docs?.source},description:{story:"Project list with progress rings, like Linear's Projects view.",...l.parameters?.docs?.description}}};export{n as Animated,c as Indeterminate,t as Playground,l as ProjectList,d as Rings,o as Sizes,i as Tones,w as __namedExportsOrder,h as default};
