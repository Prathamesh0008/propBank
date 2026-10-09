"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { User as UserIcon, Users } from "lucide-react";
import { Skeleton } from "@/ui/skeleton";
import { Agent } from "./AdminTypes";

interface AdminAgentsTabProps {
  loading: boolean;
  agents: Agent[];
  handleViewUserDetails: (user: any) => void;
}

export const AdminAgentsTab = ({
  loading,
  agents,
  handleViewUserDetails
}: AdminAgentsTabProps) => {
  return (
    <div className="space-y-6">
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Individuals Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Individuals</CardTitle>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                  {agents.filter(a => a.role === "individual" || !a.role).length}
                </span>
              </div>
              <CardDescription>Registered individual users</CardDescription>
            </CardHeader>
            <CardContent>
              {agents.filter(a => a.role === "individual" || !a.role).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No individual users found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agents.filter(a => a.role === "individual" || !a.role).map((agent) => (
                    <div key={agent.uid} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50/50 hover:bg-gray-50 transition-colors">
                      <div>
                        <h3 className="font-medium text-sm">{agent.name}</h3>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted-foreground">{agent.email}</span>
                          {agent.phoneNumber && (
                            <span className="text-xs text-muted-foreground">{agent.phoneNumber}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" onClick={() => handleViewUserDetails(agent)}>
                          View Details
                        </Button>
                        <Badge variant={agent.isActive ? "default" : "secondary"} className="text-xs">
                          {agent.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agents Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Agents</CardTitle>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                  {agents.filter(a => a.role === "agent").length}
                </span>
              </div>
              <CardDescription>Registered property agents</CardDescription>
            </CardHeader>
            <CardContent>
              {agents.filter(a => a.role === "agent").length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No agents found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agents.filter(a => a.role === "agent").map((agent) => (
                    <div key={agent.uid} className="flex items-center justify-between p-3 rounded-lg border bg-purple-50/30 hover:bg-purple-50/60 transition-colors">
                      <div>
                        <h3 className="font-medium text-sm">{agent.name}</h3>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted-foreground">{agent.email}</span>
                          {agent.phoneNumber && (
                            <span className="text-xs text-muted-foreground">{agent.phoneNumber}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" onClick={() => handleViewUserDetails(agent)}>
                          View Details
                        </Button>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize text-purple-700 border-purple-200 bg-purple-50">
                            {agent.role}
                          </Badge>
                          <Badge variant={agent.isActive ? "default" : "secondary"} className="text-xs">
                            {agent.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
