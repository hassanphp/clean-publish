"use client";

import { useParams, useRouter } from "next/navigation";
import { useGetProjectQuery, useGetProjectImagesQuery } from "@/lib/store/apiSlice";
import Layout from "@/components/Layout";
import { ProjectDetailView } from "@/components/project/ProjectDetailView";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? parseInt(params.id, 10) : NaN;
  const { data: project, isLoading: loadingProject, error: projectError } = useGetProjectQuery(id, { skip: !id || isNaN(id) });
  const { data: images = [], isLoading: loadingImages } = useGetProjectImagesQuery(id, { skip: !id || isNaN(id) });

  if (isNaN(id) || projectError || (!loadingProject && !project)) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center px-4">
          <p className="text-gray-500 mb-4">Project not found</p>
          <button
            onClick={() => router.push("/create")}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-white font-medium"
          >
            Back to Create
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <ProjectDetailView
        project={project}
        images={images}
        isLoading={loadingProject || loadingImages}
        onBack={() => router.push("/create")}
      />
    </Layout>
  );
}
